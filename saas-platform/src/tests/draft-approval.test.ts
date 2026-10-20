import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "a".repeat(64);
process.env.ENCRYPTION_KEY = KEY;

// ── sendDraft collaborators ──────────────────────────────────────────────────────────────────────────────
const findMessage = vi.fn();
const updateMessage = vi.fn();
const sendGmail = vi.fn();
vi.mock("@/dal/messages", () => ({
  MessagesDal: class {
    findById = findMessage;
    update = updateMessage;
  },
}));
vi.mock("@/dal/merchants", () => ({
  MerchantsDal: class {
    findById = async (id: string) => ({ id, googleEmail: "support@shop.test" });
  },
}));
vi.mock("@/lib/gmail/client", () => ({
  getValidAccessToken: async () => "token",
  sendGmailReply: (...args: unknown[]) => sendGmail(...args),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => fakeDb }));

import { APPROVAL_TTL_SECONDS, signApprovalToken, verifyApprovalToken } from "@/lib/automation/draft-approval";
import { sendDraft } from "@/services/draft-send-service";
import { POST as approvePost } from "@/app/api/approve/[token]/route";

/** A database with one message row whose sender the claim update really changes. */
let row: { sender: string };
const fakeDb = {
  from(table: string) {
    if (table === "conversations") {
      return { select: () => ({ eq: () => ({ single: async () => ({ data: { subject: "Waar is mijn pakket", external_id: "thr1", customer: { email: "klant@x.test" } }, error: null }) }) }) };
    }
    // messages: update({sender}).eq(id).eq(sender, expected)?.select(), or the customer's latest message
    return {
      select() {
        const chain: any = {
          eq: () => chain,
          order: () => chain,
          lte: () => chain,
          limit: () => chain,
          then: (resolve: (v: unknown) => void) => resolve({ data: [{ metadata: { threadId: "thr-customer-latest" } }] }),
        };
        return chain;
      },
      update(patch: { sender: string }) {
        const filters: Record<string, string> = {};
        const chain = {
          eq(col: string, val: string) {
            filters[col] = val;
            return chain;
          },
          async select() {
            if (filters.sender !== undefined && row.sender !== filters.sender) return { data: [] };
            row.sender = patch.sender;
            return { data: [{ id: "m1" }] };
          },
          then(resolve: (v: unknown) => void) {
            // awaited without select(): the revert
            if (filters.sender === undefined || row.sender === filters.sender) row.sender = patch.sender;
            resolve({ data: null });
          },
        };
        return chain;
      },
    };
  },
} as never;

const draft = { id: "m1", merchantId: "merchant-A", conversationId: "c1", sender: "ai_draft", content: "Hoi!", contentHtml: null, metadata: { shadow_mode: true }, createdAt: "2026-10-20T10:00:00Z" };

describe("approval tokens", () => {
  const now = 1_800_000_000;

  it("round-trips the draft and merchant it was made for", () => {
    const token = signApprovalToken({ messageId: "m1", merchantId: "merchant-A" }, now, KEY);
    expect(verifyApprovalToken(token, now + 60, KEY)).toEqual({ messageId: "m1", merchantId: "merchant-A", expiresAt: now + APPROVAL_TTL_SECONDS });
  });

  it("refuses an expired, tampered, re-signed or malformed token", () => {
    const token = signApprovalToken({ messageId: "m1", merchantId: "merchant-A" }, now, KEY);
    expect(verifyApprovalToken(token, now + APPROVAL_TTL_SECONDS, KEY)).toBeNull();

    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ m: "m1", mc: "merchant-B", e: now + 999 })).toString("base64url");
    expect(verifyApprovalToken(`${forgedBody}.${sig}`, now, KEY)).toBeNull();

    expect(verifyApprovalToken(token, now, "b".repeat(64))).toBeNull();
    expect(verifyApprovalToken("", now, KEY)).toBeNull();
    expect(verifyApprovalToken(`${token}.x`, now, KEY)).toBeNull();
    expect(verifyApprovalToken("not-a-token", now, KEY)).toBeNull();
  });
});

describe("sendDraft", () => {
  beforeEach(() => {
    row = { sender: "ai_draft" };
    findMessage.mockReset().mockImplementation(async () => ({ ...draft, sender: row.sender }));
    updateMessage.mockReset().mockImplementation(async (_id: string, patch: object) => ({ ...draft, ...patch }));
    sendGmail.mockReset().mockResolvedValue({});
  });

  it("sends a draft once to the customer, in the thread, and strips the draft markers", async () => {
    const result = await sendDraft(fakeDb, "m1", "merchant-A");
    expect(result.ok).toBe(true);
    expect(sendGmail).toHaveBeenCalledTimes(1);
    // the thread of the customer's own latest mail, not the conversation's (a conversation spans threads)
    expect(sendGmail.mock.calls[0][1]).toMatchObject({ to: "klant@x.test", threadId: "thr-customer-latest", text: "Hoi!" });
    expect(updateMessage.mock.calls[0][1].metadata).not.toHaveProperty("shadow_mode");
  });

  it("a second press sends nothing", async () => {
    await sendDraft(fakeDb, "m1", "merchant-A");
    // the page still holds the old copy of the draft: the claim, not the read, must stop it
    findMessage.mockImplementation(async () => ({ ...draft }));
    const second = await sendDraft(fakeDb, "m1", "merchant-A");
    expect(second).toMatchObject({ ok: false, code: "not_a_draft" });
    expect(sendGmail).toHaveBeenCalledTimes(1);
  });

  it("refuses another merchant's draft without sending", async () => {
    const result = await sendDraft(fakeDb, "m1", "merchant-B");
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(sendGmail).not.toHaveBeenCalled();
    expect(row.sender).toBe("ai_draft");
  });

  it("gives the draft back when Gmail fails, so it can be sent again", async () => {
    sendGmail.mockRejectedValueOnce(new Error("gmail down"));
    await expect(sendDraft(fakeDb, "m1", "merchant-A")).rejects.toThrow("gmail down");
    expect(row.sender).toBe("ai_draft");
  });
});

describe("POST /api/approve/[token]", () => {
  beforeEach(() => {
    row = { sender: "ai_draft" };
    findMessage.mockReset().mockImplementation(async () => ({ ...draft, sender: row.sender }));
    updateMessage.mockReset().mockImplementation(async (_id: string, patch: object) => ({ ...draft, ...patch }));
    sendGmail.mockReset().mockResolvedValue({});
  });

  const call = (token: string) =>
    approvePost(new Request(`https://keepmysale.com/api/approve/${token}`, { method: "POST" }), { params: Promise.resolve({ token }) });

  it("sends with a valid token and comes back to the page as sent", async () => {
    const token = signApprovalToken({ messageId: "m1", merchantId: "merchant-A" });
    const res = await call(token);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`https://keepmysale.com/approve/${token}?status=sent`);
    expect(sendGmail).toHaveBeenCalledTimes(1);
  });

  it("an expired or forged token sends nothing", async () => {
    const old = signApprovalToken({ messageId: "m1", merchantId: "merchant-A" }, Math.floor(Date.now() / 1000) - APPROVAL_TTL_SECONDS - 5);
    expect((await call(old)).headers.get("location")).toContain("status=expired");
    expect((await call("abc.def")).headers.get("location")).toContain("status=expired");
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("a token for another merchant's draft sends nothing", async () => {
    const token = signApprovalToken({ messageId: "m1", merchantId: "merchant-B" });
    expect((await call(token)).headers.get("location")).toContain("status=error");
    expect(sendGmail).not.toHaveBeenCalled();
  });
});
