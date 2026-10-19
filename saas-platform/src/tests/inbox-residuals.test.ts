import { describe, expect, it } from "vitest";
import { countUnanswered, deriveThreadStates, isSupportConversation } from "@/lib/inbox-visibility";
import { currencySymbol, dominantCurrency, formatMoney } from "@/lib/money";
import { EmailFilterService } from "@/lib/services/email-filter";

describe("a stranger is support work only once a person has replied, and every active case is", () => {
  it("hides a never-ordered sender, even when the AI answered (it used to answer Shopify and Microsoft mail)", () => {
    expect(isSupportConversation({ category: "product", isKnownCustomer: false, hasHumanReply: false })).toBe(false);
  });
  it("shows a stranger once a human has replied", () => {
    expect(isSupportConversation({ category: null, isKnownCustomer: false, hasHumanReply: true })).toBe(true);
  });
  it("shows a known customer", () => {
    expect(isSupportConversation({ category: null, isKnownCustomer: true })).toBe(true);
  });
  it.each(["returns", "negotiation_active", "human_required"])("never hides an active %s case", (category) => {
    expect(isSupportConversation({ category, isKnownCustomer: false, hasHumanReply: false })).toBe(true);
  });
  it.each(["spam", "financial", "unknown"])("always hides %s, even from a known address", (category) => {
    expect(isSupportConversation({ category, isKnownCustomer: true, hasHumanReply: true })).toBe(false);
  });
});

describe("the last sender comes from the messages, because the table has no such column", () => {
  const m = (conversationId: string, sender: string, at: string) => ({ conversationId, sender, createdAt: at });
  it("finds the newest sender and whether a person ever replied, whatever the input order", () => {
    const states = deriveThreadStates([
      m("a", "ai", "2026-06-02T10:00:00Z"),
      m("a", "customer", "2026-06-03T10:00:00Z"),
      m("a", "customer", "2026-06-01T10:00:00Z"),
      m("b", "customer", "2026-06-01T10:00:00Z"),
      m("b", "human_agent", "2026-06-02T10:00:00Z"),
    ]);
    expect(states.get("a")).toEqual({ lastSender: "customer", hasHumanReply: false });
    expect(states.get("b")).toEqual({ lastSender: "human_agent", hasHumanReply: true });
    expect(states.get("none")).toBeUndefined();
  });
});

describe("the four conversations that were actually in the inbox on 19 Oct 2026", () => {
  // senders as read from the database; the AI had answered both the Shopify and the Microsoft mail
  const production = [
    { subject: "Order #1687 confirmed", category: "product", isKnownCustomer: false, hasHumanReply: false },
    { subject: "Welcome to Brand agents family!", category: "human_required", isKnownCustomer: false, hasHumanReply: false },
    { subject: "I would like to return order #1004", category: "product", isKnownCustomer: true, hasHumanReply: false },
    { subject: "(consultant)", category: null, isKnownCustomer: false, hasHumanReply: false },
  ];
  it("shows the customer's return request and the case the AI escalated, hides the notification and the pitch", () => {
    expect(production.filter(isSupportConversation).map((c) => c.subject)).toEqual([
      "Welcome to Brand agents family!",
      "I would like to return order #1004",
    ]);
  });
});

describe("the Inbox badge is a real number", () => {
  const base = { isKnownCustomer: true, hasHumanReply: false };
  const list = [
    { ...base, status: "open", category: "shipping", lastMessageSenderType: "customer" },
    { ...base, status: "open", category: "product", lastMessageSenderType: "ai" },
    { ...base, status: "resolved", category: "shipping", lastMessageSenderType: "customer" },
    { ...base, status: "open", category: "spam", isKnownCustomer: false, lastMessageSenderType: "customer" },
    { ...base, status: "open", category: null, isKnownCustomer: false, lastMessageSenderType: "customer" },
  ];
  it("counts only open, real conversations whose newest message is the customer's (not a fixed 3)", () => {
    expect(countUnanswered(list)).toBe(1);
    expect(countUnanswered([])).toBe(0);
  });
});

describe("money is shown in the currency the orders are in", () => {
  it("picks the dominant currency, with a fallback for a shop with no orders", () => {
    expect(dominantCurrency(["USD", "USD", "EUR"])).toBe("USD");
    expect(dominantCurrency([])).toBe("EUR");
    expect(dominantCurrency(["", null, undefined, "xx", "usd"])).toBe("USD");
  });
  it("writes the right symbol (the dashboard printed € for dollar orders)", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(formatMoney(3095.13, "USD")).toBe("$3,095.13");
    expect(() => formatMoney(1, "NOPE")).not.toThrow();
  });
});

describe("senders that slipped through the filter are blocked before any database lookup", () => {
  const filter = new EmailFilterService({} as never);
  it.each([
    "store+94198071626@t.shopifyemail.com",
    "maccount@microsoft.com",
    "someone@mail.microsoftonline.com",
  ])("blocks %s", async (from) => {
    const result = await filter.shouldProcessEmail({ id: "1", from, subject: "Hello", body: "" }, [], "m1");
    expect(result.shouldProcess).toBe(false);
    expect(result.layer).toBe(1);
  });
});
