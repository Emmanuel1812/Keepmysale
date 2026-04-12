import type { SupabaseClient } from "@supabase/supabase-js";
import type { IMerchant, IMerchantCreate, IMerchantUpdate, IMerchantSettings } from "@/types";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";

type MerchantRow = Record<string, unknown>;

/**
 * Normalize raw JSONB settings from the database into the full spec-aligned shape.
 * Handles legacy field names (return_negotiation_enabled, negotiation_offers, auto_respond)
 * and fills missing fields with defaults so every merchant always has the complete settings object.
 */
function normalizeSettings(raw: Record<string, unknown> | null | undefined): IMerchantSettings {
  if (!raw) return { ...DEFAULT_MERCHANT_SETTINGS };

  return {
    ...DEFAULT_MERCHANT_SETTINGS,
    ...raw,

    // ── Renamed field migrations ──
    // auto_negotiate: new name for return_negotiation_enabled
    auto_negotiate:
      (raw.auto_negotiate as boolean | undefined) ??
      (raw.return_negotiation_enabled as boolean | undefined) ??
      DEFAULT_MERCHANT_SETTINGS.auto_negotiate,

    // negotiation_steps: new name for negotiation_offers
    negotiation_steps:
      (raw.negotiation_steps as IMerchantSettings["negotiation_steps"] | undefined) ??
      (raw.negotiation_offers as IMerchantSettings["negotiation_steps"] | undefined) ??
      DEFAULT_MERCHANT_SETTINGS.negotiation_steps,

    // auto_reply_general: new name for auto_respond
    auto_reply_general:
      (raw.auto_reply_general as boolean | undefined) ??
      (raw.auto_respond as boolean | undefined) ??
      DEFAULT_MERCHANT_SETTINGS.auto_reply_general,
  };
}

export function mapMerchantRow(row: MerchantRow): IMerchant {
  return {
    id: String(row.id),
    supabaseUserId: (row.supabase_user_id as string | null) ?? null,
    shopDomain: String(row.shop_domain),
    shopName: (row.shop_name as string | null) ?? null,
    email: String(row.email),
    shopifyAccessTokenEncrypted: (row.shopify_access_token_encrypted as string | null) ?? null,
    birdChannelId: (row.bird_channel_id as string | null) ?? null,
    whatsappPhoneNumber: (row.whatsapp_phone_number as string | null) ?? null,
    sesVerifiedDomain: (row.ses_verified_domain as string | null) ?? null,
    mollieCustomerId: (row.mollie_customer_id as string | null) ?? null,
    subscriptionTier: row.subscription_tier as IMerchant["subscriptionTier"],
    subscriptionStatus: row.subscription_status as IMerchant["subscriptionStatus"],
    trialEndsAt: (row.trial_ends_at as string | null) ?? null,
    onboardingCompleted: Boolean(row.onboarding_completed),
    settings: normalizeSettings(row.settings as Record<string, unknown> | null),
    googleAccessTokenEncrypted: (row.google_access_token_encrypted as string | null) ?? null,
    googleRefreshTokenEncrypted: (row.google_refresh_token_encrypted as string | null) ?? null,
    googleEmail: (row.google_email as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class MerchantsDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<IMerchant | null> {
    const { data, error } = await this.supabase.from("merchants").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapMerchantRow(data as MerchantRow);
  }

  async findByMerchant(merchantId: string): Promise<IMerchant[]> {
    const { data, error } = await this.supabase
      .from("merchants")
      .select("*")
      .eq("id", merchantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapMerchantRow(row as MerchantRow));
  }

  async findByUserId(supabaseUserId: string): Promise<IMerchant | null> {
    const { data, error } = await this.supabase
      .from("merchants")
      .select("*")
      .eq("supabase_user_id", supabaseUserId)
      .single();
    if (error || !data) return null;
    return mapMerchantRow(data as MerchantRow);
  }

  async findByShopDomain(shopDomain: string): Promise<IMerchant | null> {
    const { data, error } = await this.supabase
      .from("merchants")
      .select("*")
      .eq("shop_domain", shopDomain)
      .single();
    if (error || !data) return null;
    return mapMerchantRow(data as MerchantRow);
  }

  async create(input: IMerchantCreate): Promise<IMerchant> {
    const payload = {
      supabase_user_id: input.supabaseUserId ?? null,
      shop_domain: input.shopDomain,
      shop_name: input.shopName ?? null,
      email: input.email,
      subscription_tier: input.subscriptionTier ?? "starter",
      subscription_status: input.subscriptionStatus ?? "trial",
      trial_ends_at: input.trialEndsAt ?? null,
      onboarding_completed: input.onboardingCompleted ?? false,
      settings: input.settings ?? null,
      google_access_token_encrypted: input.googleAccessTokenEncrypted ?? null,
      google_refresh_token_encrypted: input.googleRefreshTokenEncrypted ?? null,
      google_email: input.googleEmail ?? null,
    };
    const { data, error } = await this.supabase.from("merchants").insert(payload).select("*").single();
    if (error || !data) throw error ?? new Error("Could not create merchant");
    return mapMerchantRow(data as MerchantRow);
  }

  async update(id: string, input: IMerchantUpdate): Promise<IMerchant> {
    const payload = {
      supabase_user_id: input.supabaseUserId,
      shop_domain: input.shopDomain,
      shop_name: input.shopName,
      email: input.email,
      shopify_access_token_encrypted: input.shopifyAccessTokenEncrypted,
      bird_channel_id: input.birdChannelId,
      whatsapp_phone_number: input.whatsappPhoneNumber,
      ses_verified_domain: input.sesVerifiedDomain,
      mollie_customer_id: input.mollieCustomerId,
      subscription_tier: input.subscriptionTier,
      subscription_status: input.subscriptionStatus,
      trial_ends_at: input.trialEndsAt,
      onboarding_completed: input.onboardingCompleted,
      settings: input.settings,
      google_access_token_encrypted: input.googleAccessTokenEncrypted,
      google_refresh_token_encrypted: input.googleRefreshTokenEncrypted,
      google_email: input.googleEmail,
    };
    const { data, error } = await this.supabase
      .from("merchants")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update merchant");
    return mapMerchantRow(data as MerchantRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("merchants").delete().eq("id", id);
    if (error) throw error;
  }
}
