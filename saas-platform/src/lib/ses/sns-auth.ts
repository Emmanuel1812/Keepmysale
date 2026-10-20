import crypto from "node:crypto";

/**
 * The SES inbound webhook is an SNS HTTPS subscription. Nothing about the request proves it came from our topic:
 * any caller could post a "Notification" and have the AI read it and, in auto-reply mode, answer an address of their
 * choosing, or post a "SubscriptionConfirmation" and make the server GET a URL of their choosing.
 *
 * So the subscription URL carries a secret (`?secret=<AWS_SNS_WEBHOOK_SECRET>`), compared in constant time, and the
 * only URL we ever confirm is a real SNS endpoint.
 */
export function isAuthorizedSnsRequest(requestUrl: string, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  const provided = new URL(requestUrl).searchParams.get("secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

export function isSnsSubscribeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SNS_HOST.test(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
