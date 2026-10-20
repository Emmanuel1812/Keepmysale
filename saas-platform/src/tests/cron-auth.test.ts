import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

const SECRET = "s3cret-value-long-enough-123";

function req(headers: Record<string, string>) {
  return new Request("https://keepmysale.com/api/cron/check-gmail", { headers });
}

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(req({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
  });

  it("does not trust the x-vercel-cron header, which anyone can send", () => {
    expect(isAuthorizedCronRequest(req({ "x-vercel-cron": "1" }), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(req({ "x-vercel-cron": "true" }), SECRET)).toBe(false);
  });

  it("refuses everything when no secret is configured, including 'Bearer undefined'", () => {
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer undefined" }), undefined)).toBe(false);
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer " }), "")).toBe(false);
    expect(isAuthorizedCronRequest(req({}), undefined)).toBe(false);
  });

  it("refuses a short secret, a wrong secret, a missing header and a different scheme", () => {
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer abc" }), "abc")).toBe(false);
    expect(isAuthorizedCronRequest(req({ authorization: `Bearer ${SECRET}x` }), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer wrong-wrong-wrong-wrong" }), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(req({}), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(req({ authorization: SECRET }), SECRET)).toBe(false);
  });
});
