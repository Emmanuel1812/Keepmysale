import { describe, expect, it, vi } from "vitest";
import { ConversationsDal } from "@/dal/conversations";

/** messages rows: which Gmail thread already lives in which conversation */
function dalWith(threadToConversation: Record<string, string>, conversations: Record<string, { customer_id: string }>) {
  const inserted: unknown[] = [];
  const supabase = {
    from(table: string) {
      if (table === "messages") {
        const filters: Record<string, string> = {};
        const chain: any = {
          select: () => chain,
          eq: (col: string, val: string) => ((filters[col] = val), chain),
          order: () => chain,
          limit: async () => {
            const id = threadToConversation[filters["metadata->>threadId"]];
            return { data: id ? [{ conversation_id: id }] : [], error: null };
          },
        };
        return chain;
      }
      // conversations
      let id = "";
      const chain: any = {
        select: () => chain,
        eq: (_c: string, v: string) => ((id = v), chain),
        in: () => chain,
        order: () => chain,
        limit: async () => ({ data: [{ id: "c-old", customer_id: "cust-1", merchant_id: "m1", channel: "email", status: "open", subject: "I would like to return order #1004", metadata: {} }], error: null }),
        single: async () =>
          conversations[id]
            ? { data: { id, merchant_id: "m1", channel: "email", status: "open", subject: "x", metadata: {}, ...conversations[id] }, error: null }
            : { data: null, error: { message: "not found" } },
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return { select: () => ({ single: async () => ({ data: { id: "c-new", ...row }, error: null }) }) };
        },
      };
      return chain;
    },
  };
  return { dal: new ConversationsDal(supabase as never), inserted };
}

const input = { merchantId: "m1", customerId: "cust-1", channel: "email" as const, subject: "Verkeerde kleur geleverd" };

describe("which conversation an inbound mail joins", () => {
  it("a reply in a thread we already have joins that conversation", async () => {
    const { dal, inserted } = dalWith({ "thr-1": "c-old" }, { "c-old": { customer_id: "cust-1" } });
    const conv = await dal.findOrCreateForThread(input, "thr-1");
    expect(conv.id).toBe("c-old");
    expect(inserted).toHaveLength(0);
  });

  it("a NEW mail from a known customer starts a new conversation under its own subject (it used to join the oldest open one)", async () => {
    const { dal, inserted } = dalWith({ "thr-1": "c-old" }, { "c-old": { customer_id: "cust-1" } });
    const conv = await dal.findOrCreateForThread(input, "thr-2");
    expect(conv.id).toBe("c-new");
    expect(inserted[0]).toMatchObject({ subject: "Verkeerde kleur geleverd", customer_id: "cust-1" });
  });

  it("never joins another customer's conversation, even on a shared thread id", async () => {
    const { dal } = dalWith({ "thr-1": "c-other" }, { "c-other": { customer_id: "cust-2" } });
    expect((await dal.findOrCreateForThread(input, "thr-1")).id).toBe("c-new");
  });

  it("without a thread id (SES) it keeps the old behaviour", async () => {
    const { dal } = dalWith({}, {});
    const spy = vi.spyOn(dal, "findOrCreate");
    await dal.findOrCreateForThread(input, null);
    expect(spy).toHaveBeenCalled();
  });
});
