import crypto from "node:crypto";

/**
 * A link that lets the merchant send ONE draft from the digest mail on a phone, without logging in.
 *
 * The token names the draft and the merchant and expires; it is signed with a key derived from ENCRYPTION_KEY
 * under its own label, so it can never be confused with anything else signed by that key. Opening the link only
 * SHOWS the draft: mail scanners and link previews open every link in a mail, so sending needs a POST from the page.
 * It is single-use by nature: once sent, the draft is no longer a draft and the send refuses it.
 */
export const APPROVAL_TTL_SECONDS = 7 * 24 * 60 * 60;

interface ApprovalPayload {
  /** message id of the draft */
  m: string;
  /** merchant id that owns it */
  mc: string;
  /** expiry, unix seconds */
  e: number;
}

export interface ApprovalClaim {
  messageId: string;
  merchantId: string;
  expiresAt: number;
}

function approvalKey(secretHex = process.env.ENCRYPTION_KEY ?? ""): Buffer {
  if (secretHex.length !== 64) throw new Error("ENCRYPTION_KEY must be a 32-byte hex string.");
  return crypto.createHmac("sha256", Buffer.from(secretHex, "hex")).update("keepmysale:draft-approval:v1").digest();
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signApprovalToken(
  claim: { messageId: string; merchantId: string },
  nowSeconds = Math.floor(Date.now() / 1000),
  secretHex?: string,
): string {
  const payload: ApprovalPayload = { m: claim.messageId, mc: claim.merchantId, e: nowSeconds + APPROVAL_TTL_SECONDS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", approvalKey(secretHex)).update(body).digest());
  return `${body}.${sig}`;
}

/** The claim when the token is genuine and not expired, otherwise null. Never throws on a bad token. */
export function verifyApprovalToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  secretHex?: string,
): ApprovalClaim | null {
  const [body, sig, extra] = String(token ?? "").split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = crypto.createHmac("sha256", approvalKey(secretHex)).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload: ApprovalPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.m !== "string" || typeof payload?.mc !== "string" || typeof payload?.e !== "number") return null;
  if (payload.e <= nowSeconds) return null;
  return { messageId: payload.m, merchantId: payload.mc, expiresAt: payload.e };
}
