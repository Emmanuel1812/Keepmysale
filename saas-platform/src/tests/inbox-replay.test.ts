import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideAutoReply } from "@/lib/automation/reply-policy";
import { analyzeEmail, findOrderForEmail, summarizeReplay, type ReplayDeps, type ReplayItem } from "@/services/replay-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";
import type { IIntentStructuredResult } from "@/types/ai";
import type { IOrder } from "@/types/order";

const intent = (over: Partial<IIntentStructuredResult>): IIntentStructuredResult => ({
  intent: "other",
  confidence: 0.9,
  extracted_order_number: null,
  language_detected: "nl",
  sentiment: "neutral",
  requires_human: false,
  reasoning: "test",
  ...over,
});

const order = (over: Partial<IOrder>): IOrder =>
  ({
    id: "o-1",
    merchantId: "m1",
    shopifyOrderId: "gid://shopify/Order/1",
    shopifyOrderNumber: "#1004",
    customerId: null,
    email: "jan@klant.nl",
    financialStatus: "paid",
    fulfillmentStatus: "fulfilled",
    totalPrice: "100.00",
    currency: "EUR",
    lineItems: [],
    createdAt: "2026-10-01T10:00:00Z",
    ...over,
  }) as IOrder;

const mail = (over: Partial<{ id: string; from: string; subject: string; body: string }> = {}) => ({
  id: "g1",
  threadId: "t1",
  from: "Jan <jan@klant.nl>",
  to: "shop@example.com",
  subject: "Retour",
  body: "Ik wil order #1004 retourneren",
  headers: [],
  receivedAt: "2026-10-02T09:00:00.000Z",
  ...over,
});

function deps(over: Partial<ReplayDeps> = {}) {
  const classify = vi.fn(async () => intent({ intent: "return", extracted_order_number: "#1004" }));
  const draft = vi.fn(async () => ({ action: "offer_partial_refund", messageBody: "We bieden 20% aan." }) as never);
  const filter = vi.fn(async () => ({ shouldProcess: true, reason: "ok", layer: 4 }));
  const d: ReplayDeps = {
    settings: { ...DEFAULT_MERCHANT_SETTINGS },
    orders: [order({})],
    filter,
    classify,
    draft,
    ...over,
  };
  return { d, classify, draft, filter };
}

describe("decideAutoReply (shared by the live pipeline and the replay)", () => {
  const s = { ...DEFAULT_MERCHANT_SETTINGS };
  it("always answers order-status questions itself", () => {
    expect(decideAutoReply(intent({ intent: "wismo", confidence: 0.1, requires_human: true }), s).skipAutoReply).toBe(false);
  });
  it("drafts a complaint for a person by default", () => {
    expect(decideAutoReply(intent({ intent: "complaint" }), s).skipAutoReply).toBe(true);
  });
  it("drafts when the classifier is less sure than the merchant's threshold", () => {
    expect(decideAutoReply(intent({ intent: "other", confidence: 0.3 }), s).skipAutoReply).toBe(true);
  });
  it("hands a return to the negotiation flow unless negotiation is switched off", () => {
    expect(decideAutoReply(intent({ intent: "return" }), s)).toMatchObject({ isNegotiation: true, skipAutoReply: false });
    expect(decideAutoReply(intent({ intent: "return" }), { ...s, auto_negotiate: false }).skipAutoReply).toBe(true);
  });
});

describe("analyzeEmail", () => {
  it("never runs the AI on mail the filter set aside", async () => {
    const { d, classify, draft } = deps({ filter: vi.fn(async () => ({ shouldProcess: false, reason: "Sender domain blocked", layer: 1 })) });
    const item = await analyzeEmail(mail(), d);
    expect(item).toMatchObject({ outcome: "filtered", reason: "Sender domain blocked" });
    expect(classify).not.toHaveBeenCalled();
    expect(draft).not.toHaveBeenCalled();
  });

  it("never runs the AI on someone who never ordered (same rule as live)", async () => {
    const { d, classify } = deps();
    const item = await analyzeEmail(mail({ from: "stranger@else.com" }), d);
    expect(item.outcome).toBe("not_customer");
    expect(classify).not.toHaveBeenCalled();
  });

  it("respects the merchant's do-not-engage subjects", async () => {
    const { d, classify } = deps({ settings: { ...DEFAULT_MERCHANT_SETTINGS, do_not_engage_subjects: ["factuur"] } });
    const item = await analyzeEmail(mail({ subject: "Uw factuur" }), d);
    expect(item.outcome).toBe("filtered");
    expect(classify).not.toHaveBeenCalled();
  });

  it("values a return request with the merchant's first offer: 20% refund on 100 keeps 80", async () => {
    const { d, draft } = deps();
    const item = await analyzeEmail(mail(), d);
    expect(item.outcome).toBe("auto_reply");
    expect(item.reply).toBe("We bieden 20% aan.");
    expect(item.returnCase).toMatchObject({ orderLabel: "#1004", orderValue: 100, eligible: true, firstOfferPercentage: 20, keptIfAccepted: 80 });
    // the reply builder reuses the classification instead of classifying again
    expect(draft).toHaveBeenCalledWith(expect.objectContaining({ intent: expect.objectContaining({ intent: "return" }) }));
  });

  it("marks a return below the merchant's minimum order value as not eligible", async () => {
    const { d } = deps({ settings: { ...DEFAULT_MERCHANT_SETTINGS, min_order_value: 150 } });
    const item = await analyzeEmail(mail(), d);
    expect(item.returnCase).toMatchObject({ eligible: false, keptIfAccepted: null });
  });

  it("reports an AI failure as an error item instead of failing the whole replay", async () => {
    const { d } = deps({ classify: vi.fn(async () => { throw new Error("quota"); }) });
    expect(await analyzeEmail(mail(), d)).toMatchObject({ outcome: "error", reason: "quota" });
  });
});

describe("findOrderForEmail", () => {
  const orders = [
    order({ id: "a", shopifyOrderNumber: "#1001", createdAt: "2026-09-01T00:00:00Z" }),
    order({ id: "b", shopifyOrderNumber: "#1004", createdAt: "2026-10-01T00:00:00Z" }),
    order({ id: "c", shopifyOrderNumber: "#2000", email: "other@x.nl" }),
  ];
  it("prefers the number the customer quoted, with or without #", () => {
    expect(findOrderForEmail(orders, "jan@klant.nl", "1001")?.id).toBe("a");
    expect(findOrderForEmail(orders, "jan@klant.nl", "#2000")?.id).toBe("c");
  });
  it("falls back to the customer's most recent order", () => {
    expect(findOrderForEmail(orders, "JAN@klant.nl", null)?.id).toBe("b");
    expect(findOrderForEmail(orders, "nobody@x.nl", null)).toBeNull();
  });
});

describe("summarizeReplay", () => {
  const rc = (value: number, kept: number, currency = "USD", eligible = true) => ({
    orderLabel: "#1", orderValue: value, currency, eligible, firstOfferPercentage: 20, firstOfferType: "partial_refund", keptIfAccepted: eligible ? kept : null,
  });
  const items: ReplayItem[] = [
    { id: "1", from: "", subject: "", receivedAt: null, snippet: "", outcome: "auto_reply", returnCase: rc(100, 80) },
    { id: "2", from: "", subject: "", receivedAt: null, snippet: "", outcome: "auto_reply", returnCase: rc(50, 40) },
    { id: "3", from: "", subject: "", receivedAt: null, snippet: "", outcome: "auto_reply", returnCase: rc(999, 0, "USD", false) },
    { id: "4", from: "", subject: "", receivedAt: null, snippet: "", outcome: "draft" },
    { id: "5", from: "", subject: "", receivedAt: null, snippet: "", outcome: "filtered" },
    { id: "6", from: "", subject: "", receivedAt: null, snippet: "", outcome: "not_customer" },
  ];

  it("counts outcomes and only values eligible returns", () => {
    const s = summarizeReplay(items, 0.5);
    expect(s).toMatchObject({ total: 6, autoReplies: 3, drafts: 1, filtered: 1, notCustomer: 1, returnRequests: 3, eligibleReturns: 2 });
    expect(s).toMatchObject({ currency: "USD", valueAtStake: 150, keptIfAllAccept: 120, expectedKept: 60 });
  });

  it("clamps the acceptance assumption to 0..1", () => {
    expect(summarizeReplay(items, 7).expectedKept).toBe(120);
    expect(summarizeReplay(items, -1).expectedKept).toBe(0);
  });
});

// ── The route: proves nothing is sent, labelled or stored ──
const sendGmailReply = vi.fn();
const markAsRead = vi.fn();
const getGmailMessage = vi.fn();
const auth = vi.fn();

vi.mock("@/lib/auth", () => ({ getMerchantFromSession: () => auth() }));
vi.mock("@/lib/gmail/client", () => ({
  getValidAccessToken: async () => "token",
  getGmailMessage: (...args: unknown[]) => getGmailMessage(...args),
  sendGmailReply: (...args: unknown[]) => sendGmailReply(...args),
  markAsRead: (...args: unknown[]) => markAsRead(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () =>
    new Proxy({}, { get: () => { throw new Error("the replay route must not touch the database directly"); } }),
}));
vi.mock("@/lib/encryption", () => ({ decryptAes256: () => "shpat" }));
vi.mock("@/lib/services/email-filter", () => ({
  EmailFilterService: class { shouldProcessEmail = async () => ({ shouldProcess: true, reason: "ok", layer: 4 }); },
}));
vi.mock("@/services/order-service", () => ({
  OrderService: class { findByMerchant = async () => [order({})]; },
}));
vi.mock("@/services/ai-service", () => ({
  AiService: class {
    classifyIntent = async () => intent({ intent: "wismo", extracted_order_number: "#1004" });
    buildAutomatedAction = async () => ({ action: "send_tracking_status", messageBody: "Je pakket is onderweg." });
  },
}));

import { POST as analyze } from "@/app/api/replay/analyze/route";

describe("POST /api/replay/analyze", () => {
  const merchant = {
    id: "m1", shopName: "Shop", shopDomain: "s.myshopify.com", googleEmail: "shop@example.com",
    googleAccessTokenEncrypted: "enc", shopifyAccessTokenEncrypted: "enc", settings: { ...DEFAULT_MERCHANT_SETTINGS },
  };
  const call = (body: unknown) =>
    analyze(new Request("https://keepmysale.com/api/replay/analyze", { method: "POST", body: JSON.stringify(body) }));

  beforeEach(() => {
    sendGmailReply.mockReset();
    markAsRead.mockReset();
    getGmailMessage.mockReset();
    getGmailMessage.mockImplementation(async (_t: string, id: string) => mail({ id, body: "Waar is order #1004?" }));
    auth.mockReset();
    auth.mockResolvedValue(merchant);
  });

  it("analyses the mails and never sends, marks read or writes", async () => {
    const res = await call({ ids: ["abc123", "def456"] });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]).toMatchObject({ outcome: "auto_reply", reply: "Je pakket is onderweg." });
    expect(sendGmailReply).not.toHaveBeenCalled();
    expect(markAsRead).not.toHaveBeenCalled();
  });

  it("refuses more ids than one request can finish, and malformed ids", async () => {
    expect((await call({ ids: ["a1b2c3", "a1b2c4", "a1b2c5", "a1b2c6"] })).status).toBe(400);
    expect((await call({ ids: ["../etc"] })).status).toBe(400);
    expect((await call({})).status).toBe(400);
  });

  it("requires a signed-in merchant with Gmail connected", async () => {
    auth.mockRejectedValueOnce(new Error("no session"));
    expect((await call({ ids: ["abc123"] })).status).toBe(401);
    auth.mockResolvedValueOnce({ ...merchant, googleEmail: null });
    expect((await call({ ids: ["abc123"] })).status).toBe(400);
  });
});
