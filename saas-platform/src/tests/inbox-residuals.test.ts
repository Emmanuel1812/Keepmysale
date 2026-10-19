import { describe, expect, it } from "vitest";
import { countUnanswered, isSupportConversation } from "@/lib/inbox-visibility";
import { currencySymbol, dominantCurrency, formatMoney } from "@/lib/money";
import { EmailFilterService } from "@/lib/services/email-filter";

describe("a stranger nobody answered is not support work, but every active case is", () => {
  it("hides a never-ordered sender whose message is still unanswered (the Microsoft / consultant mails)", () => {
    expect(isSupportConversation({ category: null, isKnownCustomer: false, lastMessageSenderType: "customer" })).toBe(false);
  });
  it("shows a known customer", () => {
    expect(isSupportConversation({ category: null, isKnownCustomer: true, lastMessageSenderType: "customer" })).toBe(true);
  });
  it("shows a stranger as soon as someone has replied", () => {
    expect(isSupportConversation({ category: null, isKnownCustomer: false, lastMessageSenderType: "human_agent" })).toBe(true);
    expect(isSupportConversation({ category: null, isKnownCustomer: false, lastMessageSenderType: "ai_draft" })).toBe(true);
  });
  it.each(["returns", "negotiation_active", "human_required"])("never hides an active %s case", (category) => {
    expect(isSupportConversation({ category, isKnownCustomer: false, lastMessageSenderType: "customer" })).toBe(true);
  });
  it.each(["spam", "financial", "unknown"])("always hides %s, even from a known address", (category) => {
    expect(isSupportConversation({ category, isKnownCustomer: true, lastMessageSenderType: "customer" })).toBe(false);
  });
});

describe("the Inbox badge is a real number", () => {
  const list = [
    { status: "open", category: "shipping", isKnownCustomer: true, lastMessageSenderType: "customer" },
    { status: "open", category: "product", isKnownCustomer: true, lastMessageSenderType: "ai" },
    { status: "resolved", category: "shipping", isKnownCustomer: true, lastMessageSenderType: "customer" },
    { status: "open", category: "spam", isKnownCustomer: false, lastMessageSenderType: "customer" },
    { status: "open", category: null, isKnownCustomer: false, lastMessageSenderType: "customer" },
  ];
  it("counts only open, real, unanswered conversations (not a fixed 3)", () => {
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
