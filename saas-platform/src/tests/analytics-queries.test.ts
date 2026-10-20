import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnalyticsService } from "@/services/analytics-service";

type Call = { table: string; columns: string; startedAt: number; finishedAt: number };

/** A fake Supabase client that records what each table read selects and how the reads overlap in time. */
function fakeSupabase(tables: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, columns: "", startedAt: 0, finishedAt: 0 };
      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          call.startedAt = performance.now();
          calls.push(call);
          return new Promise((resolve) =>
            setTimeout(() => {
              call.finishedAt = performance.now();
              resolve({ data: tables[table] ?? [], error: null });
            }, 40),
          );
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const conversation = {
  id: "c1",
  merchant_id: "m1",
  customer_id: "u1",
  channel: "email",
  status: "open",
  subject: "Where is my order",
  category: "shipping",
  is_known_customer: true,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  last_message_at: "2026-10-01T10:05:00Z",
};

const messages = [
  { conversation_id: "c1", sender: "customer", created_at: "2026-10-01T10:00:00Z" },
  { conversation_id: "c1", sender: "ai", created_at: "2026-10-01T10:05:00Z" },
];

describe("AnalyticsService.getSummary reads", () => {
  it("never downloads message bodies: only conversation id, sender and time", async () => {
    const { client, calls } = fakeSupabase({ conversations: [conversation], messages });
    await new AnalyticsService(client).getSummary("m1");
    const messageRead = calls.find((c) => c.table === "messages");
    expect(messageRead).toBeDefined();
    expect(messageRead!.columns).toBe("conversation_id, sender, created_at");
    expect(messageRead!.columns).not.toMatch(/content|\*/);
  });

  it("runs the four table reads at the same time, not one after another", async () => {
    const { client, calls } = fakeSupabase({ conversations: [conversation], messages });
    await new AnalyticsService(client).getSummary("m1");
    expect(calls.map((c) => c.table).sort()).toEqual(["conversations", "messages", "negotiations", "orders"]);
    const lastStart = Math.max(...calls.map((c) => c.startedAt));
    const firstFinish = Math.min(...calls.map((c) => c.finishedAt));
    expect(lastStart).toBeLessThan(firstFinish);
  });

  it("still derives the same answers from the slim data", async () => {
    const { client } = fakeSupabase({ conversations: [conversation], messages });
    const summary = await new AnalyticsService(client).getSummary("m1");
    expect(summary.openConversations).toBe(1);
    expect(summary.aiHandled).toBe(1);
    expect(summary.avgResponseTime).toBeCloseTo(5, 5);
  });
});
