import crypto from "crypto";
import { verifyGithubActionsToken } from "@/lib/github-oidc";

/**
 * Cron endpoints (Gmail polling, proactive checks) act on every merchant's mailbox, so only the scheduler may call them.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set on the project, and the
 * GitHub pinger sends the same header. The `x-vercel-cron` header is NOT proof of anything: any caller can add it.
 * With no secret configured every request is refused, so a missing env var can never open the endpoint
 * (the old check compared against the string "Bearer undefined").
 */
export function isAuthorizedCronRequest(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The shared secret (Vercel Cron) OR a GitHub Actions OIDC token from our own poll workflow (lib/github-oidc.ts),
 * so the 5-minute GitHub schedule needs no secret stored in GitHub.
 */
export async function isAuthorizedCronCall(request: Request, secret: string | undefined): Promise<boolean> {
  if (isAuthorizedCronRequest(request, secret)) return true;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.split(".").length !== 3) return false;
  const result = await verifyGithubActionsToken(token);
  if (!result.ok) console.warn(`[cron-auth] GitHub OIDC token refused: ${result.reason}`);
  return result.ok;
}
