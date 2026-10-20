import crypto from "node:crypto";

/**
 * The install route hands Shopify a random `state` and remembers it in this cookie; the callback only proceeds when
 * Shopify echoes the same value back to the same browser. Without it an attacker can start an install for their own
 * shop, send the victim the resulting callback link, and get the victim's session attached to the attacker's shop.
 */
export const OAUTH_STATE_COOKIE = "kms_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

/** Shopify stamps the callback query with a unix timestamp; a callback older than this is a replay. */
export const OAUTH_CALLBACK_MAX_AGE_SECONDS = 900;

export function isValidOAuthState(cookieValue: string | undefined | null, stateParam: string | null): boolean {
  if (!cookieValue || !stateParam) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(stateParam);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isFreshOAuthTimestamp(
  timestamp: string | null,
  now = Math.floor(Date.now() / 1000),
  maxAgeSeconds = OAUTH_CALLBACK_MAX_AGE_SECONDS,
): boolean {
  const value = Number(timestamp);
  if (!timestamp || !Number.isFinite(value)) return false;
  return Math.abs(now - value) <= maxAgeSeconds;
}
