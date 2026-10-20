import { describe, expect, it, vi } from "vitest";
import { createExchangeReturn, fetchProductVariants, hasExchangeScopes } from "@/lib/shopify/exchange-client";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("fetchProductVariants", () => {
  it("reads sizes with stock when the shop allows it", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ data: { product: { variants: { nodes: [{ id: "gid://shopify/ProductVariant/12", title: "M", inventoryQuantity: 3, inventoryPolicy: "DENY", inventoryItem: { tracked: true }, selectedOptions: [{ value: "M" }] }] } } } }),
    ) as unknown as typeof fetch;
    const { variants, stockKnown } = await fetchProductVariants("s.myshopify.com", "t", "77", fetchImpl);
    expect(stockKnown).toBe(true);
    expect(variants[0]).toMatchObject({ id: "12", title: "M", inventoryQuantity: 3, inventoryManagement: "shopify", inventoryPolicy: "deny" });
  });

  it("without the inventory permission, retries without stock and says stock is unknown", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ errors: [{ message: "Access denied for inventoryQuantity field" }] }))
      .mockResolvedValueOnce(json({ data: { product: { variants: { nodes: [{ id: "gid://shopify/ProductVariant/13", title: "L", inventoryPolicy: "DENY" }] } } } }));
    const { variants, stockKnown } = await fetchProductVariants("s.myshopify.com", "t", "77", fetchImpl as unknown as typeof fetch);
    expect(stockKnown).toBe(false);
    expect(variants[0]).toMatchObject({ id: "13", inventoryQuantity: null, inventoryManagement: "unknown" });
  });
});

describe("createExchangeReturn", () => {
  // a fresh Response each time: a body can only be read once
  const returnable = () => json({
    data: {
      returnableFulfillments: {
        nodes: [{ returnableFulfillmentLineItems: { nodes: [
          { quantity: 1, fulfillmentLineItem: { id: "gid://shopify/FulfillmentLineItem/900", lineItem: { variant: { id: "gid://shopify/ProductVariant/12" } } } },
          { quantity: 1, fulfillmentLineItem: { id: "gid://shopify/FulfillmentLineItem/901", lineItem: { variant: { id: "gid://shopify/ProductVariant/99" } } } },
        ] } }],
      },
    },
  });

  it("returns the fulfilled line of that variant and adds the new size as an exchange", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(returnable()).mockResolvedValueOnce(json({ data: { returnCreate: { return: { id: "gid://shopify/Return/5" }, userErrors: [] } } }));
    const result = await createExchangeReturn("s.myshopify.com", "t", { orderId: "555", returnVariantId: "12", exchangeVariantId: "13", reason: "SIZE_TOO_SMALL" }, fetchImpl as unknown as typeof fetch);
    expect(result.returnId).toBe("gid://shopify/Return/5");
    const sent = JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string);
    expect(sent.variables.input).toMatchObject({
      orderId: "gid://shopify/Order/555",
      returnLineItems: [{ fulfillmentLineItemId: "gid://shopify/FulfillmentLineItem/900", quantity: 1, returnReason: "SIZE_TOO_SMALL" }],
      exchangeLineItems: [{ variantId: "gid://shopify/ProductVariant/13", quantity: 1 }],
      notifyCustomer: true,
    });
  });

  it("fails loudly on Shopify user errors and on an unfulfilled item", async () => {
    const userError = vi.fn().mockResolvedValueOnce(returnable()).mockResolvedValueOnce(json({ data: { returnCreate: { return: null, userErrors: [{ message: "Variant is out of stock" }] } } }));
    await expect(createExchangeReturn("s.myshopify.com", "t", { orderId: "555", returnVariantId: "12", exchangeVariantId: "13", reason: "OTHER" }, userError as unknown as typeof fetch)).rejects.toThrow("Variant is out of stock");

    const none = vi.fn().mockResolvedValueOnce(json({ data: { returnableFulfillments: { nodes: [] } } }));
    await expect(createExchangeReturn("s.myshopify.com", "t", { orderId: "555", returnVariantId: "12", exchangeVariantId: "13", reason: "OTHER" }, none as unknown as typeof fetch)).rejects.toThrow("No returnable");
  });
});

describe("hasExchangeScopes", () => {
  it("needs both read_returns and write_returns", () => {
    expect(hasExchangeScopes(["read_orders", "read_returns", "write_returns"])).toBe(true);
    expect(hasExchangeScopes(["read_orders", "read_returns"])).toBe(false);
  });
});
