import { describe, expect, it, vi } from "vitest";

const tables: Record<string, unknown[]> = {
  negotiations: [{ status: "completed", savings: 12.5, refund_processed: true }],
  orders: [{ currency: "USD" }, { currency: "USD" }, { currency: "EUR" }],
};

/** Every chain method returns the builder; awaiting it resolves to that table's rows. */
function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) b[m] = () => b;
  b.then = (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [], error: null });
  return b;
}

vi.mock("@/lib/auth", () => ({ getMerchantFromSession: async () => ({ id: "m1", shopDomain: "s.myshopify.com" }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => ({ from: (t: string) => builder(t) }) }));

import { GET } from "@/app/api/returns/route";

describe("Returns KPIs currency", () => {
  it("reports savings in the store's main currency instead of always EUR", async () => {
    const body = await (await GET(new Request("https://keepmysale.com/api/returns?tab=all"))).json();
    expect(body.data.kpis.currency).toBe("USD");
    expect(body.data.kpis.savedRevenue).toBe(12.5);
  });
});
