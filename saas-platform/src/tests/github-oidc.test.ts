import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { CRON_OIDC_AUDIENCE, GITHUB_OIDC_ISSUER, resetGithubKeyCache, verifyGithubActionsToken } from "@/lib/github-oidc";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-kid";
const jwks = { keys: [{ ...(publicKey.export({ format: "jwk" }) as object), kid: KID, alg: "RS256", use: "sig" }] };
const fakeFetch = (async () => new Response(JSON.stringify(jwks), { status: 200 })) as unknown as typeof fetch;

const NOW = 1_800_000_000;
const goodClaims = {
  iss: GITHUB_OIDC_ISSUER,
  aud: CRON_OIDC_AUDIENCE,
  exp: NOW + 300,
  nbf: NOW - 10,
  iat: NOW - 10,
  repository: "Emmanuel1812/Keepmysale",
  repository_id: "1205150319",
  ref: "refs/heads/saas-platform-clean",
  workflow_ref: "Emmanuel1812/Keepmysale/.github/workflows/keepmysale-gmail-poll.yml@refs/heads/saas-platform-clean",
  event_name: "schedule",
};

function sign(claims: Record<string, unknown>, key: crypto.KeyObject = privateKey, kid = KID) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), key).toString("base64url");
  return `${h}.${p}.${s}`;
}

const verify = (token: string) => verifyGithubActionsToken(token, { now: NOW, fetchImpl: fakeFetch });

describe("GitHub Actions OIDC token for the cron endpoint", () => {
  beforeEach(() => resetGithubKeyCache());

  it("accepts a token GitHub signed for our poll workflow on the production branch", async () => {
    expect(await verify(sign(goodClaims))).toMatchObject({ ok: true });
    expect(await verify(sign({ ...goodClaims, event_name: "workflow_dispatch" }))).toMatchObject({ ok: true });
  });

  it("refuses a token signed with any other key", async () => {
    expect(await verify(sign(goodClaims, other.privateKey))).toEqual({ ok: false, reason: "signature" });
  });

  it("refuses a tampered payload", async () => {
    const [h, , s] = sign(goodClaims).split(".");
    const forged = Buffer.from(JSON.stringify({ ...goodClaims, repository_id: "999" })).toString("base64url");
    expect(await verify(`${h}.${forged}.${s}`)).toEqual({ ok: false, reason: "signature" });
  });

  it.each([
    ["issuer", { iss: "https://evil.example" }],
    ["audience", { aud: "something-else" }],
    ["expired", { exp: NOW - 1 }],
    ["repository", { repository_id: "42" }],
    ["ref", { ref: "refs/pull/7/merge" }],
    ["workflow", { workflow_ref: "Emmanuel1812/Keepmysale/.github/workflows/other.yml@refs/heads/saas-platform-clean" }],
    ["event", { event_name: "pull_request" }],
  ])("refuses a valid signature with the wrong %s", async (reason, change) => {
    expect(await verify(sign({ ...goodClaims, ...change }))).toEqual({ ok: false, reason });
  });

  it("refuses an unknown key id and garbage", async () => {
    expect(await verify(sign(goodClaims, privateKey, "other-kid"))).toEqual({ ok: false, reason: "unknown_key" });
    expect(await verify("not-a-token")).toEqual({ ok: false, reason: "malformed" });
  });
});
