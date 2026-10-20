import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "sns-secret-value-0123456789";
const fetchSpy = vi.fn();
const handleInboundEmail = vi.fn();

vi.mock("@/lib/env", () => ({ getEnv: () => ({ AWS_SNS_WEBHOOK_SECRET: SECRET }) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: "m1" }], error: null }) }) }),
    }),
  }),
}));
vi.mock("@/services/webhook-service", () => ({
  WebhookService: class {
    handleInboundEmail = handleInboundEmail;
  },
}));

import { POST } from "@/app/api/webhooks/ses/route";
import { isSnsSubscribeUrl } from "@/lib/ses/sns-auth";

const url = (query = "") => `https://keepmysale.com/api/webhooks/ses${query}`;
const post = (body: unknown, query = "") => POST(new Request(url(query), { method: "POST", body: JSON.stringify(body) }));

const notification = {
  Type: "Notification",
  Message: JSON.stringify({ mail: { messageId: "x", source: "a@b.nl", commonHeaders: { subject: "Hi" } } }),
};

describe("SES inbound webhook auth", () => {
  beforeEach(() => {
    fetchSpy.mockReset();
    handleInboundEmail.mockReset();
    handleInboundEmail.mockResolvedValue({ action: "draft_saved" });
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("refuses a notification without the secret and never runs the AI", async () => {
    const res = await post(notification);
    expect(res.status).toBe(401);
    expect(handleInboundEmail).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    const res = await post(notification, "?secret=guess-guess-guess-guess");
    expect(res.status).toBe(401);
    expect(handleInboundEmail).not.toHaveBeenCalled();
  });

  it("accepts a notification that carries the secret", async () => {
    const res = await post(notification, `?secret=${SECRET}`);
    expect(res.status).toBe(200);
    expect(handleInboundEmail).toHaveBeenCalledTimes(1);
  });

  it("never fetches a SubscribeURL that is not an SNS endpoint (no server-side request forgery)", async () => {
    const res = await post({ Type: "SubscriptionConfirmation", SubscribeURL: "http://169.254.169.254/latest/meta-data" }, `?secret=${SECRET}`);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("confirms a real SNS SubscribeURL", async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const res = await post(
      { Type: "SubscriptionConfirmation", SubscribeURL: "https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&Token=t" },
      `?secret=${SECRET}`,
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("only SNS hosts over https pass the URL check", () => {
    expect(isSnsSubscribeUrl("https://sns.eu-west-1.amazonaws.com/x")).toBe(true);
    expect(isSnsSubscribeUrl("http://sns.eu-west-1.amazonaws.com/x")).toBe(false);
    expect(isSnsSubscribeUrl("https://sns.eu-west-1.amazonaws.com.evil.com/x")).toBe(false);
    expect(isSnsSubscribeUrl("https://evil.com/sns.eu-west-1.amazonaws.com")).toBe(false);
    expect(isSnsSubscribeUrl("https://user:pw@sns.eu-west-1.amazonaws.com/x")).toBe(false);
    expect(isSnsSubscribeUrl(undefined)).toBe(false);
  });
});
