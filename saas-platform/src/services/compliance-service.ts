import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shopify's three mandatory privacy topics.
 * https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 *
 * - customers/data_request: a customer asked what we hold about them.
 * - customers/redact: erase that customer's personal data.
 * - shop/redact: 48 h after uninstall, erase everything about the shop.
 */
export const COMPLIANCE_TOPICS = ["customers/data_request", "customers/redact", "shop/redact"] as const;
export type ComplianceTopic = (typeof COMPLIANCE_TOPICS)[number];

export interface CustomerPayload {
  shop_domain?: string;
  customer?: { id?: number | string; email?: string | null; phone?: string | null };
  orders_to_redact?: Array<number | string>;
  orders_requested?: Array<number | string>;
}

export interface ComplianceStore {
  findMerchantIdByShop(shopDomain: string): Promise<string | null>;
  findCustomerIds(merchantId: string, shopifyCustomerId: string | null, email: string | null): Promise<string[]>;
  /** Replace the personal data on orders (by customer email and/or Shopify order id). Returns how many. */
  anonymizeOrders(merchantId: string, email: string | null, shopifyOrderIds: string[]): Promise<number>;
  /** Delete customers; conversations, messages and negotiations of those customers cascade. */
  deleteCustomers(merchantId: string, customerIds: string[]): Promise<number>;
  /** Delete the merchant; every row about the shop cascades. Also removes the login of the shop owner. */
  deleteMerchant(merchantId: string): Promise<void>;
}

export interface ComplianceResult {
  topic: ComplianceTopic;
  handled: boolean;
  detail: Record<string, number | string | boolean>;
}

const REDACTED_EMAIL_DOMAIN = "redacted.invalid";

/**
 * ILIKE treats % and _ as wildcards, and "_" is common in real addresses ("jan_de@x.nl" would also match
 * "janXde@x.nl"). An erasure must never reach a different person, so escape them.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => "\\" + character);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase();
  return value.includes("@") ? value : null;
}

export class ComplianceService {
  constructor(private readonly store: ComplianceStore) {}

  async handle(topic: ComplianceTopic, shopDomain: string, payload: CustomerPayload): Promise<ComplianceResult> {
    const merchantId = await this.store.findMerchantIdByShop(shopDomain.trim().toLowerCase());

    // Nothing stored about this shop (never connected, or already erased): the request is satisfied.
    if (!merchantId) return { topic, handled: false, detail: { reason: "unknown_shop" } };

    if (topic === "shop/redact") {
      await this.store.deleteMerchant(merchantId);
      return { topic, handled: true, detail: { merchantDeleted: true } };
    }

    if (topic === "customers/redact") {
      const email = normalizeEmail(payload.customer?.email);
      const shopifyCustomerId = payload.customer?.id != null ? String(payload.customer.id) : null;
      const orderIds = (payload.orders_to_redact ?? []).map(String);

      const customerIds = await this.store.findCustomerIds(merchantId, shopifyCustomerId, email);
      // Orders first: deleting the customer would otherwise leave their email behind on the order rows.
      const orders = await this.store.anonymizeOrders(merchantId, email, orderIds);
      const customers = customerIds.length ? await this.store.deleteCustomers(merchantId, customerIds) : 0;
      return { topic, handled: true, detail: { customersDeleted: customers, ordersAnonymized: orders } };
    }

    // customers/data_request: there is no self-service export yet. The request is recorded (the route logs it
    // with the topic and shop, never the customer's data) and the owner sends the data to the merchant within
    // 30 days. See docs/COMPLIANCE.md.
    return { topic, handled: true, detail: { recorded: true } };
  }
}

/** Supabase implementation. Thin on purpose: all decisions live in ComplianceService. */
export class SupabaseComplianceStore implements ComplianceStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async findMerchantIdByShop(shopDomain: string): Promise<string | null> {
    const { data, error } = await this.supabase.from("merchants").select("id").eq("shop_domain", shopDomain).maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  }

  async findCustomerIds(merchantId: string, shopifyCustomerId: string | null, email: string | null): Promise<string[]> {
    const ids = new Set<string>();
    if (shopifyCustomerId) {
      const { data, error } = await this.supabase
        .from("customers").select("id").eq("merchant_id", merchantId).eq("shopify_customer_id", shopifyCustomerId);
      if (error) throw error;
      for (const row of data ?? []) ids.add(String(row.id));
    }
    if (email) {
      const { data, error } = await this.supabase
        .from("customers").select("id").eq("merchant_id", merchantId).ilike("email", escapeLikePattern(email));
      if (error) throw error;
      for (const row of data ?? []) ids.add(String(row.id));
    }
    return [...ids];
  }

  async anonymizeOrders(merchantId: string, email: string | null, shopifyOrderIds: string[]): Promise<number> {
    const { data: rows, error } = await this.supabase
      .from("orders").select("id, email, shopify_order_id").eq("merchant_id", merchantId);
    if (error) throw error;

    const wanted = new Set(shopifyOrderIds);
    const matching = (rows ?? []).filter((row) => {
      const byEmail = email && String(row.email ?? "").trim().toLowerCase() === email;
      // shopify_order_id is stored as a gid ("gid://shopify/Order/123") or a bare number
      const bareId = String(row.shopify_order_id ?? "").split("/").pop() ?? "";
      return byEmail || wanted.has(bareId);
    });

    for (const row of matching) {
      const { error: updateError } = await this.supabase
        .from("orders")
        .update({ email: `${String(row.id)}@${REDACTED_EMAIL_DOMAIN}`, customer_id: null })
        .eq("id", row.id)
        .eq("merchant_id", merchantId);
      if (updateError) throw updateError;
    }
    return matching.length;
  }

  async deleteCustomers(merchantId: string, customerIds: string[]): Promise<number> {
    const { data, error } = await this.supabase
      .from("customers").delete().eq("merchant_id", merchantId).in("id", customerIds).select("id");
    if (error) throw error;
    return (data ?? []).length;
  }

  async deleteMerchant(merchantId: string): Promise<void> {
    const { data: merchant, error: readError } = await this.supabase
      .from("merchants").select("supabase_user_id").eq("id", merchantId).maybeSingle();
    if (readError) throw readError;

    const { error } = await this.supabase.from("merchants").delete().eq("id", merchantId);
    if (error) throw error;

    // The shop owner's login goes with the shop; failing to remove it must not undo the erasure above.
    if (merchant?.supabase_user_id) {
      const { error: authError } = await this.supabase.auth.admin.deleteUser(String(merchant.supabase_user_id));
      if (authError) console.warn("[compliance] shop erased, but its login could not be removed:", authError.message);
    }
  }
}
