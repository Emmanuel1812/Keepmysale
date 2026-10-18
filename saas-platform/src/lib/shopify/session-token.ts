import crypto from "node:crypto";
import { isValidShopDomain } from "@/lib/shopify/auth";

/**
 * Shopify session tokens: the JWT App Bridge hands an embedded app so it can prove which
 * shop is calling without third-party cookies (which browsers block inside the admin iframe).
 *
 * The shop is trusted ONLY after every check below passes. Never take a shop from a header,
 * a query string or an unverified token.
 *
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */

export type SessionTokenFailure =
  | "malformed"
  | "bad_algorithm"
  | "bad_signature"
  | "expired"
  | "not_yet_valid"
  | "wrong_audience"
  | "bad_issuer"
  | "bad_destination";

export type SessionTokenResult =
  | { ok: true; shop: string; userId: string | null; expiresAt: number }
  | { ok: false; reason: SessionTokenFailure };

export interface SessionTokenOptions {
  apiKey: string;
  apiSecret: string;
  /** unix seconds; injectable for tests */
  now?: number;
  /** tolerated clock difference between Shopify and us, in seconds */
  skewSeconds?: number;
}

function b64urlDecode(part: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) return null;
  return Buffer.from(part, "base64url");
}

function parseJson(buf: Buffer | null): Record<string, unknown> | null {
  if (!buf) return null;
  try {
    const value = JSON.parse(buf.toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hostOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.host.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function verifyShopifySessionToken(token: string, options: SessionTokenOptions): SessionTokenResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = parseJson(b64urlDecode(headerPart));
  const payload = parseJson(b64urlDecode(payloadPart));
  const signature = b64urlDecode(signaturePart);
  if (!header || !payload || !signature) return { ok: false, reason: "malformed" };

  // Pin the algorithm: never let the token choose how it is verified ("none", RS256 confusion).
  if (header.alg !== "HS256") return { ok: false, reason: "bad_algorithm" };

  const expected = crypto.createHmac("sha256", options.apiSecret).update(`${headerPart}.${payloadPart}`).digest();
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const skew = options.skewSeconds ?? 10;
  if (typeof payload.exp !== "number" || payload.exp + skew < now) return { ok: false, reason: "expired" };
  if (typeof payload.nbf !== "number" || payload.nbf - skew > now) return { ok: false, reason: "not_yet_valid" };

  if (payload.aud !== options.apiKey) return { ok: false, reason: "wrong_audience" };

  const destHost = hostOf(payload.dest);
  if (!destHost || !isValidShopDomain(destHost)) return { ok: false, reason: "bad_destination" };

  // iss is "https://<shop>/admin" and must name the same shop as dest.
  if (typeof payload.iss !== "string" || hostOf(payload.iss) !== destHost || !/\/admin\/?$/.test(payload.iss)) {
    return { ok: false, reason: "bad_issuer" };
  }

  return {
    ok: true,
    shop: destHost,
    userId: typeof payload.sub === "string" ? payload.sub : null,
    expiresAt: payload.exp,
  };
}

/** Extracts the token from "Authorization: Bearer <token>"; null when absent or not a bearer. */
export function bearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+([A-Za-z0-9_.-]+)$/.exec(headerValue.trim());
  return match ? match[1] : null;
}
