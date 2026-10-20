import crypto from "node:crypto";

/**
 * Lets the GitHub Actions poll workflow call the cron endpoint without a shared secret stored in GitHub.
 *
 * GitHub signs a short-lived OIDC token for the running job (RS256, keys published at JWKS_URL). We accept it only
 * when it was issued by GitHub, for our audience, for THIS repository (by numeric id, which survives renames), from
 * the poll workflow on the production branch, triggered by the schedule or by hand. A fork's pull request gets a
 * token too, but with a pull_request event and a refs/pull/... ref, so it is refused.
 */
export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const GITHUB_OIDC_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
export const CRON_OIDC_AUDIENCE = "keepmysale-cron";

export const EXPECTED_RUN = {
  repositoryId: "1205150319", // Emmanuel1812/Keepmysale
  ref: "refs/heads/saas-platform-clean",
  workflowPath: ".github/workflows/keepmysale-gmail-poll.yml",
  events: ["schedule", "workflow_dispatch"],
} as const;

type Jwk = crypto.JsonWebKey & { kid?: string };
type Claims = Record<string, unknown>;

let cachedKeys: { at: number; keys: Jwk[] } | null = null;

async function githubKeys(fetchImpl: typeof fetch): Promise<Jwk[]> {
  if (cachedKeys && Date.now() - cachedKeys.at < 10 * 60 * 1000) return cachedKeys.keys;
  const res = await fetchImpl(GITHUB_OIDC_JWKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub JWKS ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  cachedKeys = { at: Date.now(), keys: body.keys ?? [] };
  return cachedKeys.keys;
}

/** For tests: forget the cached GitHub keys. */
export function resetGithubKeyCache() {
  cachedKeys = null;
}

const b64url = (part: string) => Buffer.from(part, "base64url");

export async function verifyGithubActionsToken(
  token: string,
  options: { now?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ ok: true; claims: Claims } | { ok: false; reason: string }> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  let header: { alg?: string; kid?: string };
  let claims: Claims;
  try {
    header = JSON.parse(b64url(parts[0]).toString("utf8"));
    claims = JSON.parse(b64url(parts[1]).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (header.alg !== "RS256" || !header.kid) return { ok: false, reason: "alg" };

  let keys: Jwk[];
  try {
    keys = await githubKeys(options.fetchImpl ?? fetch);
  } catch {
    return { ok: false, reason: "jwks_unavailable" };
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: "unknown_key" };

  const signatureValid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: "jwk" }),
    b64url(parts[2]),
  );
  if (!signatureValid) return { ok: false, reason: "signature" };

  const exp = Number(claims.exp);
  const nbf = Number(claims.nbf ?? claims.iat ?? 0);
  if (claims.iss !== GITHUB_OIDC_ISSUER) return { ok: false, reason: "issuer" };
  if (claims.aud !== CRON_OIDC_AUDIENCE) return { ok: false, reason: "audience" };
  if (!Number.isFinite(exp) || exp < now) return { ok: false, reason: "expired" };
  if (nbf > now + 60) return { ok: false, reason: "not_yet_valid" };
  if (String(claims.repository_id) !== EXPECTED_RUN.repositoryId) return { ok: false, reason: "repository" };
  if (claims.ref !== EXPECTED_RUN.ref) return { ok: false, reason: "ref" };
  const workflowRef = String(claims.workflow_ref ?? "");
  if (!workflowRef.includes(`/${EXPECTED_RUN.workflowPath}@${EXPECTED_RUN.ref}`)) return { ok: false, reason: "workflow" };
  if (!(EXPECTED_RUN.events as readonly string[]).includes(String(claims.event_name))) return { ok: false, reason: "event" };

  return { ok: true, claims };
}
