import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComplianceService, escapeLikePattern, type ComplianceStore } from "@/services/compliance-service";

// No network, no database. The route test replaces only the Supabase-backed store; the service is the real one.

class MemoryStore implements ComplianceStore {
  merchants = new Map<string, string>([["efo-testing-store.myshopify.com", "m1"]]);
  customers = [
    { id: "c1", merchantId: "m1", shopifyId: "501", email: "karine@example.com" },
    { id: "c2", merchantId: "m1", shopifyId: "502", email: "russell@example.com" },
    { id: "c3", merchantId: "other", shopifyId: "501", email: "karine@example.com" }, // another shop, same person
  ];
  orders = [
    { id: "o1", merchantId: "m1", email: "karine@example.com", shopifyOrderId: "gid://shopify/Order/9001" },
    { id: "o2", merchantId: "m1", email: "russell@example.com", shopifyOrderId: "gid://shopify/Order/9002" },
    { id: "o3", merchantId: "m1", email: "someone@else.com", shopifyOrderId: "9003" },
    { id: "o4", merchantId: "other", email: "karine@example.com", shopifyOrderId: "9001" },
  ];
  deletedMerchants: string[] = [];

  async findMerchantIdByShop(shop: string) { return this.merchants.get(shop) ?? null; }
  async findCustomerIds(merchantId: string, shopifyId: string | null, email: string | null) {
    return this.customers
      .filter((c) => c.merchantId === merchantId && ((shopifyId && c.shopifyId === shopifyId) || (email && c.email === email)))
      .map((c) => c.id);
  }
  async anonymizeOrders(merchantId: string, email: string | null, ids: string[]) {
    let n = 0;
    for (const o of this.orders) {
      const bare = o.shopifyOrderId.split("/").pop()!;
      if (o.merchantId === merchantId && ((email && o.email === email) || ids.includes(bare))) {
        o.email = `${o.id}@redacted.invalid`;
        n++;
      }
    }
    return n;
  }
  async deleteCustomers(merchantId: string, ids: string[]) {
    const before = this.customers.length;
    this.customers = this.customers.filter((c) => !(c.merchantId === merchantId && ids.includes(c.id)));
    return before - this.customers.length;
  }
  async deleteMerchant(id: string) { this.deletedMerchants.push(id); }
}

let store: MemoryStore;
beforeEach(() => { store = new MemoryStore(); });
const shop = "efo-testing-store.myshopify.com";

describe("customers/redact erases one customer in one shop, and nothing else", () => {
  it("deletes the customer and anonymises their orders by email and by order id", async () => {
    const result = await new ComplianceService(store).handle("customers/redact", shop, {
      customer: { id: 501, email: "Karine@Example.com" },
      orders_to_redact: [9002],
    });
    expect(result.detail).toEqual({ customersDeleted: 1, ordersAnonymized: 2 });
    expect(store.customers.map((c) => c.id)).toEqual(["c2", "c3"]);
    expect(store.orders.find((o) => o.id === "o1")!.email).toBe("o1@redacted.invalid");
    expect(store.orders.find((o) => o.id === "o2")!.email).toBe("o2@redacted.invalid"); // listed in orders_to_redact
  });

  it("never touches another shop's data for the same person, nor unrelated orders", async () => {
    await new ComplianceService(store).handle("customers/redact", shop, { customer: { id: 501, email: "karine@example.com" } });
    expect(store.customers.find((c) => c.id === "c3")).toBeDefined();
    expect(store.orders.find((o) => o.id === "o4")!.email).toBe("karine@example.com");
    expect(store.orders.find((o) => o.id === "o3")!.email).toBe("someone@else.com");
  });

  it("is idempotent: Shopify may deliver the same request twice", async () => {
    const service = new ComplianceService(store);
    await service.handle("customers/redact", shop, { customer: { id: 501, email: "karine@example.com" } });
    const second = await service.handle("customers/redact", shop, { customer: { id: 501, email: "karine@example.com" } });
    expect(second.detail).toEqual({ customersDeleted: 0, ordersAnonymized: 0 });
  });

  it("does not match everything when the payload has no identifying data", async () => {
    const result = await new ComplianceService(store).handle("customers/redact", shop, { customer: {} });
    expect(result.detail).toEqual({ customersDeleted: 0, ordersAnonymized: 0 });
    expect(store.customers).toHaveLength(3);
  });
});

describe("shop/redact erases the shop", () => {
  it("deletes the merchant", async () => {
    const result = await new ComplianceService(store).handle("shop/redact", shop, {});
    expect(result).toMatchObject({ handled: true, detail: { merchantDeleted: true } });
    expect(store.deletedMerchants).toEqual(["m1"]);
  });
  it("answers a shop we never stored with 'nothing to erase', without error", async () => {
    const result = await new ComplianceService(store).handle("shop/redact", "never-installed.myshopify.com", {});
    expect(result).toMatchObject({ handled: false, detail: { reason: "unknown_shop" } });
    expect(store.deletedMerchants).toEqual([]);
  });
});

describe("customers/data_request", () => {
  it("is acknowledged and changes nothing", async () => {
    const result = await new ComplianceService(store).handle("customers/data_request", shop, { customer: { id: 501 } });
    expect(result).toMatchObject({ handled: true, detail: { recorded: true } });
    expect(store.customers).toHaveLength(3);
  });
});

describe("matching a customer by email must not reach anyone else", () => {
  it("escapes the SQL wildcards that real addresses contain", () => {
    expect(escapeLikePattern("jan_de@x.nl")).toBe(String.raw`jan\_de@x.nl`);
    expect(escapeLikePattern("100%@x.nl")).toBe(String.raw`100\%@x.nl`);
    expect(escapeLikePattern(String.raw`a\b@x.nl`)).toBe(String.raw`a\\b@x.nl`);
    expect(escapeLikePattern("plain@x.nl")).toBe("plain@x.nl");
  });
});

// ---- the route: signature, topic and shop checks ----------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => ({}) }));
const sharedStore = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/services/compliance-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/compliance-service")>("@/services/compliance-service");
  return { ...actual, SupabaseComplianceStore: class { constructor() { return sharedStore.current as object; } } };
});

import { POST } from "@/app/api/webhooks/shopify/compliance/route";

const SECRET = process.env.SHOPIFY_API_SECRET as string;
const sign = (body: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");

function call(body: unknown, opts: { topic?: string; shop?: string; secret?: string; signature?: string | null } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = {
    "x-shopify-topic": opts.topic ?? "customers/redact",
    "x-shopify-shop-domain": opts.shop ?? shop,
  };
  if (opts.signature !== null) headers["x-shopify-hmac-sha256"] = opts.signature ?? sign(raw, opts.secret);
  return POST(new Request("https://keepmysale.com/api/webhooks/shopify/compliance", { method: "POST", body: raw, headers }));
}

describe("the privacy webhook endpoint", () => {
  beforeEach(() => { sharedStore.current = store; });

  it("accepts a correctly signed request and performs the erasure", async () => {
    const res = await call({ shop_domain: shop, customer: { id: 501, email: "karine@example.com" } });
    expect(res.status).toBe(200);
    expect(store.customers.find((c) => c.id === "c1")).toBeUndefined();
  });

  it("answers 401 to a request signed with another secret and erases nothing", async () => {
    const res = await call({ customer: { id: 501, email: "karine@example.com" } }, { secret: "attacker" });
    expect(res.status).toBe(401);
    expect(store.customers).toHaveLength(3);
  });

  it("answers 401 to a missing or tampered signature", async () => {
    expect((await call({ customer: { id: 501 } }, { signature: null })).status).toBe(401);
    const tampered = JSON.stringify({ customer: { id: 501 } });
    const sig = sign(tampered);
    expect((await call(tampered + " ", { signature: sig })).status).toBe(401);
  });

  it("refuses an unknown topic and a malformed shop even when correctly signed", async () => {
    expect((await call({}, { topic: "orders/create" })).status).toBe(400);
    expect((await call({}, { shop: "evil.com" })).status).toBe(400);
    expect((await call("not json")).status).toBe(400);
  });
});
