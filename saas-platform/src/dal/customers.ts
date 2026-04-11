import type { SupabaseClient } from "@supabase/supabase-js";
import type { ICustomer, ICustomerCreate, ICustomerUpdate } from "@/types/customer";

type CustomerRow = Record<string, unknown>;

function mapCustomerRow(row: CustomerRow): ICustomer {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    shopifyCustomerId: (row.shopify_customer_id as string | null) ?? null,
    language: String(row.language ?? "nl"),
    metadata: ((row.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class CustomersDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<ICustomer | null> {
    const { data, error } = await this.supabase.from("customers").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapCustomerRow(data as CustomerRow);
  }

  async findByMerchant(merchantId: string): Promise<ICustomer[]> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapCustomerRow(row as CustomerRow));
  }

  async create(input: ICustomerCreate): Promise<ICustomer> {
    const { data, error } = await this.supabase
      .from("customers")
      .insert({
        merchant_id: input.merchantId,
        email: input.email ?? null,
        phone: input.phone ?? null,
        name: input.name ?? null,
        shopify_customer_id: input.shopifyCustomerId ?? null,
        language: input.language ?? "nl",
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create customer");
    return mapCustomerRow(data as CustomerRow);
  }

  async update(id: string, input: ICustomerUpdate): Promise<ICustomer> {
    const { data, error } = await this.supabase
      .from("customers")
      .update({
        email: input.email,
        phone: input.phone,
        name: input.name,
        shopify_customer_id: input.shopifyCustomerId,
        language: input.language,
        metadata: input.metadata,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update customer");
    return mapCustomerRow(data as CustomerRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  }

  async findOrCreate(input: ICustomerCreate): Promise<ICustomer> {
    if (!input.email && !input.phone) {
      throw new Error("findOrCreate requires at least email or phone.");
    }

    const findResult = await this.supabase
      .from("customers")
      .select("*")
      .eq("merchant_id", input.merchantId)
      .or(
        [
          input.email ? `email.eq.${input.email}` : null,
          input.phone ? `phone.eq.${input.phone}` : null,
        ]
          .filter(Boolean)
          .join(","),
      );

    if (findResult.error) throw findResult.error;

    const existing = (findResult.data ?? [])[0] as CustomerRow | undefined;
    if (existing) {
      const merged = await this.update(String(existing.id), {
        email: (existing.email as string | null) ?? input.email ?? null,
        phone: (existing.phone as string | null) ?? input.phone ?? null,
        name: input.name ?? ((existing.name as string | null) ?? null),
        shopifyCustomerId:
          input.shopifyCustomerId ?? ((existing.shopify_customer_id as string | null) ?? null),
        language: input.language ?? String(existing.language ?? "nl"),
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) ?? {}),
          ...(input.metadata ?? {}),
        },
      });
      return merged;
    }

    try {
      return await this.create(input);
    } catch (err: any) {
      // Handle race condition: if another process inserted the customer in the meantime (Error 23505)
      // Retry the search once.
      if (err.code === "23505") {
        console.log("[DAL] Retrying findOrCreate due to unique constraint violation (race condition).");
        return this.findOrCreate(input);
      }
      throw err;
    }
  }

}
