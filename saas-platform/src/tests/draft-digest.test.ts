import { describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "c".repeat(64);

import { buildDigestMail, localClock, shouldSendDigest, INSTANT_MIN_GAP_MS } from "@/services/draft-digest-service";
import { verifyApprovalToken } from "@/lib/automation/draft-approval";

const AMS = "Europe/Amsterdam";
// 21 Oct 2026: Amsterdam is UTC+2 (summer time ends 25 Oct)
const at = (iso: string) => new Date(iso);

describe("localClock", () => {
  it("reads the merchant's wall clock, not UTC", () => {
    expect(localClock(at("2026-10-21T05:30:00Z"), AMS)).toEqual({ date: "2026-10-21", hour: 7 });
    expect(localClock(at("2026-10-20T22:30:00Z"), AMS)).toEqual({ date: "2026-10-21", hour: 0 });
  });

  it("falls back to Amsterdam on an unknown timezone instead of throwing", () => {
    expect(localClock(at("2026-10-21T06:00:00Z"), "Mars/Olympus")).toEqual({ date: "2026-10-21", hour: 8 });
  });
});

describe("shouldSendDigest", () => {
  const base = { timeZone: AMS, pendingCount: 2, newestDraftAt: "2026-10-21T04:00:00Z" };

  it("daily: not before 08:00 local, then once that day", () => {
    expect(shouldSendDigest({ ...base, mode: "daily", now: at("2026-10-21T05:55:00Z"), lastSentAt: null })).toBe(false); // 07:55
    expect(shouldSendDigest({ ...base, mode: "daily", now: at("2026-10-21T06:00:00Z"), lastSentAt: null })).toBe(true); // 08:00
    expect(shouldSendDigest({ ...base, mode: "daily", now: at("2026-10-21T15:00:00Z"), lastSentAt: "2026-10-21T06:00:00Z" })).toBe(false);
    expect(shouldSendDigest({ ...base, mode: "daily", now: at("2026-10-22T06:05:00Z"), lastSentAt: "2026-10-21T06:00:00Z" })).toBe(true);
  });

  it("daily: the day boundary is local (sent 23:30 local yesterday, 00:30 UTC today)", () => {
    // last mail 2026-10-20T21:30Z = 23:30 on the 20th in Amsterdam; now 08:10 on the 21st
    expect(shouldSendDigest({ ...base, mode: "daily", now: at("2026-10-21T06:10:00Z"), lastSentAt: "2026-10-20T21:30:00Z" })).toBe(true);
  });

  it("instant: only for a draft newer than the last mail, and at most every quarter hour", () => {
    const last = "2026-10-21T08:00:00Z";
    expect(shouldSendDigest({ ...base, mode: "instant", now: at("2026-10-21T08:20:00Z"), lastSentAt: last, newestDraftAt: "2026-10-21T07:59:00Z" })).toBe(false);
    expect(shouldSendDigest({ ...base, mode: "instant", now: at("2026-10-21T08:05:00Z"), lastSentAt: last, newestDraftAt: "2026-10-21T08:04:00Z" })).toBe(false);
    const later = new Date(new Date(last).getTime() + INSTANT_MIN_GAP_MS).toISOString();
    expect(shouldSendDigest({ ...base, mode: "instant", now: at(later), lastSentAt: last, newestDraftAt: "2026-10-21T08:04:00Z" })).toBe(true);
    expect(shouldSendDigest({ ...base, mode: "instant", now: at("2026-10-21T08:05:00Z"), lastSentAt: null })).toBe(true);
  });

  it("never with nothing waiting, never when off", () => {
    expect(shouldSendDigest({ ...base, pendingCount: 0, mode: "daily", now: at("2026-10-21T09:00:00Z"), lastSentAt: null })).toBe(false);
    expect(shouldSendDigest({ ...base, mode: "off", now: at("2026-10-21T09:00:00Z"), lastSentAt: null })).toBe(false);
  });
});

describe("buildDigestMail", () => {
  const drafts = [
    { id: "d1", createdAt: "2026-10-21T07:00:00Z", content: "Hoi Sanne, je pakket is onderweg.", subject: "Waar blijft <b>mijn</b> order?", customerEmail: "sanne@x.test", customerName: "Sanne" },
    { id: "d2", createdAt: "2026-10-21T06:00:00Z", content: "x".repeat(400), subject: null, customerEmail: "p@x.test", customerName: null },
  ];

  it("links every draft to its own approval page, signed for this merchant", () => {
    const mail = buildDigestMail({ drafts, total: 2, appUrl: "https://keepmysale.com/", merchantId: "merchant-A", storeName: "EFO" });
    const links = [...mail.html.matchAll(/href="https:\/\/keepmysale\.com\/approve\/([^"]+)"/g)].map((m) => m[1]);
    expect(links).toHaveLength(2);
    expect(links.map((t) => verifyApprovalToken(t))).toEqual([
      expect.objectContaining({ messageId: "d1", merchantId: "merchant-A" }),
      expect.objectContaining({ messageId: "d2", merchantId: "merchant-A" }),
    ]);
    expect(mail.subject).toBe("2 drafts are waiting for you · EFO");
  });

  it("escapes customer text and shortens long drafts", () => {
    const mail = buildDigestMail({ drafts, total: 2, appUrl: "https://keepmysale.com", merchantId: "m", storeName: "EFO" });
    expect(mail.html).not.toContain("<b>mijn</b>");
    expect(mail.html).toContain("&lt;b&gt;mijn&lt;/b&gt;");
    expect(mail.text).not.toContain("x".repeat(200));
  });

  it("says how many more wait when the list is cut", () => {
    const mail = buildDigestMail({ drafts: drafts.slice(0, 1), total: 5, appUrl: "https://keepmysale.com", merchantId: "m", storeName: "EFO" });
    expect(mail.html).toContain("And 4 more");
    expect(mail.subject).toBe("5 drafts are waiting for you · EFO");
  });
});
