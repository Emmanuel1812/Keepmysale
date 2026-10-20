import { beforeEach, describe, expect, it, vi } from "vitest";

const findByMerchant = vi.fn();
const fromSpy = vi.fn(() => {
  throw new Error("the orders route must not query tables directly");
});

vi.mock("@/lib/auth", () => ({ getMerchantFromSession: async () => ({ id: "merchant-new" }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => ({ from: fromSpy }) }));
vi.mock("@/services/order-service", () => ({
  OrderService: class {
    findByMerchant = findByMerchant;
  },
}));

import { GET } from "@/app/api/orders/route";

describe("GET /api/orders tenant isolation", () => {
  beforeEach(() => {
    findByMerchant.mockReset();
    fromSpy.mockClear();
  });

  it("a merchant with no orders gets an empty list, never other merchants' orders", async () => {
    findByMerchant.mockResolvedValue([]);
    const res = await GET(new Request("https://keepmysale.com/api/orders"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.orders).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
    expect(findByMerchant).toHaveBeenCalledWith("merchant-new");
  });

  it("returns exactly what the merchant-scoped service returns", async () => {
    findByMerchant.mockResolvedValue([{ id: "o1", merchantId: "merchant-new" }]);
    const body = await (await GET(new Request("https://keepmysale.com/api/orders"))).json();
    expect(body.data.orders).toEqual([{ id: "o1", merchantId: "merchant-new" }]);
  });
});
