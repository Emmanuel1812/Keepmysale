import { beforeEach, describe, expect, it, vi } from "vitest";

// No network, no database: the four data-access classes are replaced with fixed data.
const data = vi.hoisted(() => ({
  conversations: [] as unknown[],
  messages: [] as unknown[],
  orders: [] as unknown[],
  negotiations: [] as unknown[],
}));
vi.mock("@/dal/conversations", () => ({ ConversationsDal: class { findByMerchant = async () => data.conversations; } }));
vi.mock("@/dal/messages", () => ({ MessagesDal: class { findByMerchant = async () => data.messages; } }));
vi.mock("@/dal/orders", () => ({ OrdersDal: class { findByMerchant = async () => data.orders; } }));
vi.mock("@/dal/negotiations", () => ({ NegotiationsDal: class { findByMerchant = async () => data.negotiations; } }));

import { AnalyticsService } from "@/services/analytics-service";
import { isNonSupportCategory } from "@/lib/inbox-visibility";

const t0 = "2026-10-01T10:00:00.000Z";
const conv = (id: string, category: string | null, status = "open") => ({ id, category, status, resolvedAt: null });
const msg = (conversationId: string, sender: string, at: string) => ({ conversationId, sender, createdAt: at });

beforeEach(() => {
  data.orders = [];
  data.negotiations = [];
  data.conversations = [
    conv("customer-answered", "shipping"),
    conv("customer-unanswered", "product"),
    conv("registry", "unknown"),
    conv("whois", "spam"),
    conv("bank", "financial"),
    conv("bounce", "spam"),
  ];
  data.messages = [
    msg("customer-answered", "customer", t0),
    msg("customer-answered", "ai", "2026-10-01T10:01:00.000Z"),
    msg("customer-unanswered", "customer", t0),
    msg("registry", "customer", t0),
    msg("whois", "customer", t0),
    msg("bank", "customer", t0),
    msg("bounce", "customer", t0),
  ];
});

describe("dashboard numbers describe support work, not everything in the Gmail inbox", () => {
  it("counts only real support conversations as open", async () => {
    const summary = await new AnalyticsService({} as never).getSummary("m1");
    expect(summary.openConversations).toBe(2); // not 6
  });

  it("'AI handled' means the AI produced an answer, not merely that mail arrived", async () => {
    const summary = await new AnalyticsService({} as never).getSummary("m1");
    expect(summary.aiHandled).toBe(1); // before: every conversation without a human reply counted (6)
  });

  it("a draft the AI wrote counts (pilots run in draft-only mode); a human reply takes it back", async () => {
    data.messages.push(msg("customer-unanswered", "ai_draft", "2026-10-01T10:05:00.000Z"));
    expect((await new AnalyticsService({} as never).getSummary("m1")).aiHandled).toBe(2);
    data.messages.push(msg("customer-unanswered", "human_agent", "2026-10-01T10:06:00.000Z"));
    expect((await new AnalyticsService({} as never).getSummary("m1")).aiHandled).toBe(1);
  });

  it("filtered mail does not distort the response time", async () => {
    data.messages.push(msg("registry", "ai", "2026-10-05T10:00:00.000Z")); // 4 days later, in a filtered conversation
    const summary = await new AnalyticsService({} as never).getSummary("m1");
    expect(summary.avgResponseTime).toBeCloseTo(1, 5); // only the 1-minute genuine answer
  });
});

describe("which categories are set aside", () => {
  it.each(["spam", "financial", "unknown"])("%s is not support work", (category) => {
    expect(isNonSupportCategory(category)).toBe(true);
  });
  it.each(["shipping", "returns", "product", "human_required", "negotiation_active", null, undefined])(
    "%s stays visible",
    (category) => {
      expect(isNonSupportCategory(category as string | null | undefined)).toBe(false);
    },
  );
});
