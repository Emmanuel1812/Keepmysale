import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExchangeService } from "@/services/exchange-service";
import type { ExchangeState } from "@/lib/automation/exchange";
import type { IOrder } from "@/types/order";

const order = {
  id: "o1",
  shopifyOrderId: "gid://shopify/Order/555",
  shopifyOrderNumber: "#1004",
  lineItems: [{ title: "Winterjas", product_id: 77, variant_id: 12, variant_title: "M" }],
} as unknown as IOrder;

const variants = [
  { id: "11", title: "S", options: ["S"], inventoryQuantity: 2, inventoryManagement: "shopify", inventoryPolicy: "deny" },
  { id: "12", title: "M", options: ["M"], inventoryQuantity: 5, inventoryManagement: "shopify", inventoryPolicy: "deny" },
  { id: "13", title: "L", options: ["L"], inventoryQuantity: 1, inventoryManagement: "shopify", inventoryPolicy: "deny" },
];

function setup(canCreate = true) {
  const deps = {
    loadVariants: vi.fn(async () => ({ variants, stockKnown: true })),
    createReturn: vi.fn(async () => ({ returnId: "gid://shopify/Return/9" })),
    canCreateReturns: vi.fn(async () => canCreate),
  };
  return { deps, service: new ExchangeService(deps) };
}

const base = { intent: "return", order, language: "nl", storeName: "Shop", now: "2026-10-21T08:00:00Z" };

describe("ExchangeService", () => {
  let offered: ExchangeState;

  beforeEach(async () => {
    const { service } = setup();
    offered = (await service.decide({ ...base, mode: "suggest", text: "De winterjas is te klein, kan ik ruilen?" }))!.state;
  });

  it("offers the in-stock sizes for a size return, never the current one", async () => {
    const { service } = setup();
    const decision = await service.decide({ ...base, mode: "suggest", text: "De jas is te klein" });
    expect(decision?.state).toMatchObject({ status: "offered", reason: "SIZE_TOO_SMALL", orderId: "gid://shopify/Order/555" });
    expect(decision?.state.options.map((o) => o.label)).toEqual(["S", "L"]);
    expect(decision?.messageBody).toMatch(/S, L/);
    expect(decision?.messageBody).toMatch(/volledige aankoopbedrag terug/);
  });

  it("stays out of returns that are not about the size, and when it is switched off", async () => {
    const { service } = setup();
    expect(await service.decide({ ...base, mode: "suggest", text: "Hij is kapot aangekomen" })).toBeNull();
    expect(await service.decide({ ...base, mode: "off", text: "te klein" })).toBeNull();
    expect(await service.decide({ ...base, mode: "suggest", intent: "wismo", text: "te klein" })).toBeNull();
  });

  it("suggest mode: the customer's choice becomes a request for the merchant, nothing is created in Shopify", async () => {
    const { service, deps } = setup();
    const decision = await service.decide({ ...base, mode: "suggest", text: "Doe maar L", existing: offered });
    expect(decision?.state).toMatchObject({ status: "requested", chosen: { label: "L" } });
    expect(deps.createReturn).not.toHaveBeenCalled();
    expect(decision?.messageBody).toMatch(/ruilen je Winterjas voor L/);
  });

  it("automatic mode: creates the exchange in Shopify when the shop granted the scopes", async () => {
    const { service, deps } = setup(true);
    const decision = await service.decide({ ...base, mode: "automatic", text: "L graag", existing: offered });
    expect(deps.createReturn).toHaveBeenCalledWith({ orderId: "gid://shopify/Order/555", returnVariantId: "12", exchangeVariantId: "13", reason: "SIZE_TOO_SMALL" });
    expect(decision?.state).toMatchObject({ status: "created", shopifyReturnId: "gid://shopify/Return/9" });
  });

  it("automatic mode without the scopes, or when Shopify refuses, falls back to a request", async () => {
    const noScopes = setup(false);
    expect((await noScopes.service.decide({ ...base, mode: "automatic", text: "L", existing: offered }))?.state.status).toBe("requested");
    expect(noScopes.deps.createReturn).not.toHaveBeenCalled();

    const failing = setup(true);
    failing.deps.createReturn.mockRejectedValueOnce(new Error("No returnable fulfilled line item"));
    const decision = await failing.service.decide({ ...base, mode: "automatic", text: "L", existing: offered });
    expect(decision?.state).toMatchObject({ status: "requested", error: "No returnable fulfilled line item" });
  });

  it("asks again when the reply names no single size, and steps aside when the customer declines", async () => {
    const { service } = setup();
    expect((await service.decide({ ...base, mode: "suggest", text: "Welke is groter?", existing: offered }))?.messageBody).toMatch(/Welke maat/);
    const declined = await service.decide({ ...base, mode: "suggest", text: "Nee, liever mijn geld terug", existing: offered });
    expect(declined).toMatchObject({ messageBody: null, state: { status: "declined" } });
  });

  it("does not offer again once handled", async () => {
    const { service } = setup();
    expect(await service.decide({ ...base, mode: "suggest", text: "te klein", existing: { ...offered, status: "declined" } })).toBeNull();
  });
});
