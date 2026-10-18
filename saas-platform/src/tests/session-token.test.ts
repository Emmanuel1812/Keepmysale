import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { bearerToken, verifyShopifySessionToken } from "@/lib/shopify/session-token";

// Pure tests: no network, no database. The secret below is a throwaway used only here.
const API_KEY = "test-client-id";
const API_SECRET = "test-client-secret";
const NOW = 1_800_000_000;
const SHOP = "efo-testing-store.myshopify.com";

const b64 = (value: unknown) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

function sign(headerPart: string, payloadPart: string, secret = API_SECRET) {
  return crypto.createHmac("sha256", secret).update(`${headerPart}.${payloadPart}`).digest("base64url");
}

function makeToken(overrides: Record<string, unknown> = {}, opts: { secret?: string; header?: unknown } = {}) {
  const header = b64(opts.header ?? { alg: "HS256", typ: "JWT" });
  const payload = b64({
    iss: `https://${SHOP}/admin`,
    dest: `https://${SHOP}`,
    aud: API_KEY,
    sub: "42",
    exp: NOW + 60,
    nbf: NOW - 5,
    iat: NOW - 5,
    jti: "abc",
    ...overrides,
  });
  return `${header}.${payload}.${sign(header, payload, opts.secret)}`;
}

const verify = (token: string, now = NOW) => verifyShopifySessionToken(token, { apiKey: API_KEY, apiSecret: API_SECRET, now });

describe("a genuine Shopify session token", () => {
  it("is accepted and yields the shop from the verified token", () => {
    expect(verify(makeToken())).toEqual({ ok: true, shop: SHOP, userId: "42", expiresAt: NOW + 60 });
  });
});

describe("forged or stale session tokens are refused", () => {
  it("rejects a token signed with another secret", () => {
    expect(verify(makeToken({}, { secret: "attacker-secret" }))).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a payload that was edited after signing (someone else's shop)", () => {
    const [h, , s] = makeToken().split(".");
    const forgedPayload = b64({ iss: "https://victim.myshopify.com/admin", dest: "https://victim.myshopify.com", aud: API_KEY, exp: NOW + 60, nbf: NOW - 5 });
    expect(verify(`${h}.${forgedPayload}.${s}`)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects alg none and any algorithm other than HS256", () => {
    const header = b64({ alg: "none", typ: "JWT" });
    const payload = b64({ iss: `https://${SHOP}/admin`, dest: `https://${SHOP}`, aud: API_KEY, exp: NOW + 60, nbf: NOW - 5 });
    expect(verify(`${header}.${payload}.`)).toEqual({ ok: false, reason: "malformed" });
    expect(verify(makeToken({}, { header: { alg: "none" } }))).toEqual({ ok: false, reason: "bad_algorithm" });
    expect(verify(makeToken({}, { header: { alg: "RS256" } }))).toEqual({ ok: false, reason: "bad_algorithm" });
  });

  it("rejects an expired token, beyond the clock skew", () => {
    expect(verify(makeToken({ exp: NOW - 11 }))).toEqual({ ok: false, reason: "expired" });
    expect(verify(makeToken({ exp: NOW - 5 })).ok).toBe(true);
  });

  it("rejects a token that is not valid yet", () => {
    expect(verify(makeToken({ nbf: NOW + 11 }))).toEqual({ ok: false, reason: "not_yet_valid" });
  });

  it("rejects a token minted for another app", () => {
    expect(verify(makeToken({ aud: "someone-elses-client-id" }))).toEqual({ ok: false, reason: "wrong_audience" });
  });

  it.each([
    ["not a myshopify host", { dest: "https://evil.com", iss: "https://evil.com/admin" }],
    ["http instead of https", { dest: `http://${SHOP}`, iss: `http://${SHOP}/admin` }],
    ["a path smuggled into dest", { dest: `https://${SHOP}.evil.com` }],
  ])("rejects a bad destination: %s", (_label, override) => {
    const result = verify(makeToken(override));
    expect(result.ok).toBe(false);
  });

  it("rejects an issuer that names a different shop than dest", () => {
    expect(verify(makeToken({ iss: "https://other-store.myshopify.com/admin" }))).toEqual({ ok: false, reason: "bad_issuer" });
  });

  it.each(["", "abc", "a.b", "a.b.c.d", "@@@.@@@.@@@"])("rejects garbage %j", (garbage) => {
    expect(verify(garbage).ok).toBe(false);
  });
});

describe("reading the Authorization header", () => {
  it("accepts only a well-formed bearer token", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer abc")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
  });
});
