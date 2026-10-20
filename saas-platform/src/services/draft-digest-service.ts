import type { SupabaseClient } from "@supabase/supabase-js";
import { MerchantsDal } from "@/dal/merchants";
import { getValidAccessToken, sendGmailReply } from "@/lib/gmail/client";
import { APPROVAL_TTL_SECONDS, signApprovalToken } from "@/lib/automation/draft-approval";
import type { IMerchant } from "@/types";

/**
 * "N drafts are waiting": a mail to the merchant after the Gmail poll, so drafts get approved from a phone
 * instead of waiting until someone opens the dashboard. Each draft links to /approve/<token>, a page that shows
 * the customer's message and the draft with one Send button.
 *
 * The mail goes out from the merchant's own connected Gmail to their login address, carrying DIGEST_HEADER so the
 * poller never treats it as a customer mail when both addresses are the same inbox.
 */
export type DraftDigestMode = "daily" | "instant" | "off";
export const DIGEST_HEADER = "X-KeepMySale-Kind";
export const DIGEST_HEADER_VALUE = "draft-digest";
export const DIGEST_LOCAL_HOUR = 8;
export const INSTANT_MIN_GAP_MS = 15 * 60 * 1000;
const MAX_LISTED = 20;

export interface PendingDraft {
  id: string;
  createdAt: string;
  content: string;
  subject: string | null;
  customerEmail: string | null;
  customerName: string | null;
}

/** Date (YYYY-MM-DD) and hour of `at` on the merchant's wall clock. */
export function localClock(at: Date, timeZone: string): { date: string; hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(at);
  } catch {
    return localClock(at, "Europe/Amsterdam");
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function shouldSendDigest(input: {
  mode: DraftDigestMode;
  now: Date;
  timeZone: string;
  lastSentAt: string | null | undefined;
  pendingCount: number;
  newestDraftAt: string | null;
}): boolean {
  const { mode, now, timeZone, lastSentAt, pendingCount, newestDraftAt } = input;
  if (mode === "off" || pendingCount <= 0) return false;
  const last = lastSentAt ? new Date(lastSentAt) : null;
  const lastValid = last && !Number.isNaN(last.getTime()) ? last : null;

  if (mode === "instant") {
    if (!newestDraftAt) return false;
    if (!lastValid) return true;
    // Only for a draft that arrived after the last mail, and not more than once per quarter hour
    return new Date(newestDraftAt) > lastValid && now.getTime() - lastValid.getTime() >= INSTANT_MIN_GAP_MS;
  }

  // daily: once per local day, from 08:00
  const today = localClock(now, timeZone);
  if (today.hour < DIGEST_LOCAL_HOUR) return false;
  return !lastValid || localClock(lastValid, timeZone).date !== today.date;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function preview(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function buildDigestMail(input: {
  drafts: PendingDraft[];
  total: number;
  appUrl: string;
  merchantId: string;
  storeName: string;
  nowSeconds?: number;
}): { subject: string; html: string; text: string } {
  const { drafts, total, appUrl, merchantId, storeName } = input;
  const base = appUrl.replace(/\/+$/, "");
  const noun = total === 1 ? "draft is" : "drafts are";
  const subject = `${total} ${noun} waiting for you · ${storeName}`;

  const rows = drafts.map((d) => {
    const link = `${base}/approve/${signApprovalToken({ messageId: d.id, merchantId }, input.nowSeconds)}`;
    const who = d.customerName || d.customerEmail || "Customer";
    return { link, who, subject: d.subject || "(no subject)", body: preview(d.content) };
  });

  const html = `<!doctype html><html><body style="margin:0;background:#f8fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b1220">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
  <p style="margin:0 0 4px;font-size:13px;color:#64748b">KeepMySale · ${escapeHtml(storeName)}</p>
  <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3">${total} ${noun} waiting for you</h1>
  <p style="margin:0 0 22px;font-size:14px;line-height:1.5;color:#475569">Read each reply and send it with one tap. Nothing is sent until you press Send.</p>
  ${rows
    .map(
      (r) => `<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 12px">
    <p style="margin:0;font-size:14px;font-weight:600">${escapeHtml(r.who)}</p>
    <p style="margin:2px 0 10px;font-size:13px;color:#64748b">${escapeHtml(r.subject)}</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#334155">${escapeHtml(r.body)}</p>
    <a href="${r.link}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:10px">Review and send</a>
  </div>`,
    )
    .join("\n  ")}
  ${total > drafts.length ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b">And ${total - drafts.length} more in <a href="${base}/dashboard/inbox" style="color:#0f766e">your inbox</a>.</p>` : ""}
  <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#94a3b8">Links work for ${Math.round(APPROVAL_TTL_SECONDS / 86400)} days. Change or turn off this mail in KeepMySale → Settings → Automation.</p>
</div></body></html>`;

  const text = [
    `${total} ${noun} waiting for you (${storeName})`,
    "Nothing is sent until you press Send.",
    "",
    ...rows.flatMap((r) => [`${r.who}: ${r.subject}`, r.body, `Review and send: ${r.link}`, ""]),
    total > drafts.length ? `And ${total - drafts.length} more: ${base}/dashboard/inbox` : "",
  ].join("\n");

  return { subject, html, text };
}

export class DraftDigestService {
  constructor(private readonly supabase: SupabaseClient) {}

  async pendingDrafts(merchantId: string, now: Date): Promise<{ drafts: PendingDraft[]; total: number }> {
    // A draft older than an approval link's lifetime is stale; it stays in the inbox but is not mailed
    const since = new Date(now.getTime() - APPROVAL_TTL_SECONDS * 1000).toISOString();
    const { data, count, error } = await this.supabase
      .from("messages")
      .select("id, content, created_at, conversation:conversations(subject, customer:customers(email, name))", { count: "exact" })
      .eq("merchant_id", merchantId)
      .eq("sender", "ai_draft")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_LISTED);
    if (error) throw error;
    const drafts = (data ?? []).map((row: any) => {
      const conversation = Array.isArray(row.conversation) ? row.conversation[0] : row.conversation;
      const customer = Array.isArray(conversation?.customer) ? conversation.customer[0] : conversation?.customer;
      return {
        id: String(row.id),
        createdAt: String(row.created_at),
        content: String(row.content ?? ""),
        subject: conversation?.subject ?? null,
        customerEmail: customer?.email ?? null,
        customerName: customer?.name ?? null,
      };
    });
    return { drafts, total: count ?? drafts.length };
  }

  /** Sends the digest when it is due. Returns whether a mail went out. */
  async runForMerchant(merchant: IMerchant, appUrl: string, now = new Date()): Promise<boolean> {
    const settings = (merchant.settings ?? {}) as unknown as Record<string, unknown>;
    const mode = (settings.draft_digest as DraftDigestMode | undefined) ?? "daily";
    const to = merchant.email || merchant.googleEmail;
    if (mode === "off" || !to || !merchant.googleEmail) return false;

    const { drafts, total } = await this.pendingDrafts(merchant.id, now);
    const due = shouldSendDigest({
      mode,
      now,
      timeZone: String(settings.business_hours_timezone || settings.timezone || "Europe/Amsterdam"),
      lastSentAt: settings.draft_digest_last_sent_at as string | null | undefined,
      pendingCount: total,
      newestDraftAt: drafts[0]?.createdAt ?? null,
    });
    if (!due) return false;

    const storeName = merchant.shopName || merchant.shopDomain.replace(".myshopify.com", "");
    const mail = buildDigestMail({ drafts, total, appUrl, merchantId: merchant.id, storeName });
    const accessToken = await getValidAccessToken(merchant);
    await sendGmailReply(accessToken, {
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      asReply: false,
      headers: { [DIGEST_HEADER]: DIGEST_HEADER_VALUE },
    });

    // Re-read so a settings save made while this ran is not overwritten
    const merchants = new MerchantsDal(this.supabase);
    const fresh = ((await merchants.findById(merchant.id))?.settings ?? settings) as unknown as Record<string, unknown>;
    await merchants.update(merchant.id, {
      settings: { ...fresh, draft_digest_last_sent_at: now.toISOString() } as any,
    });
    return true;
  }
}
