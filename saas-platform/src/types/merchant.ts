export interface INegotiationOfferConfig {
  step: number;
  type: "partial_refund" | "store_credit";
  percentage: number;
}

export interface IMerchantSettings {
  business_hours: {
    start: string;
    end: string;
  };
  timezone: string;
  auto_respond: boolean;
  language: string;
  return_negotiation_enabled: boolean;
  negotiation_offers: INegotiationOfferConfig[];
  escalation_email: string | null;
  proactive_check_enabled: boolean;
  proactive_check_delay_hours: number;
}

export interface IMerchant {
  id: string;
  supabaseUserId: string | null;
  shopDomain: string;
  shopName: string | null;
  email: string;
  shopifyAccessTokenEncrypted: string | null;
  birdChannelId: string | null;
  whatsappPhoneNumber: string | null;
  sesVerifiedDomain: string | null;
  mollieCustomerId: string | null;
  googleAccessTokenEncrypted: string | null;
  googleRefreshTokenEncrypted: string | null;
  googleEmail: string | null;
  subscriptionTier: "trial" | "starter" | "growth" | "scale";
  subscriptionStatus: "trial" | "active" | "past_due" | "cancelled";
  trialEndsAt: string | null;
  onboardingCompleted: boolean;
  settings: IMerchantSettings;
  createdAt: string;
  updatedAt: string;
}

export type TMerchantSettings = IMerchantSettings;

export interface IMerchantCreate {
  supabaseUserId?: string | null;
  shopDomain: string;
  shopName?: string | null;
  email: string;
  subscriptionTier?: "trial" | "starter" | "growth" | "scale";
  subscriptionStatus?: "trial" | "active" | "past_due" | "cancelled";
  trialEndsAt?: string | null;
  onboardingCompleted?: boolean;
  settings?: IMerchantSettings;
  googleAccessTokenEncrypted?: string | null;
  googleRefreshTokenEncrypted?: string | null;
  googleEmail?: string | null;
}

export interface IMerchantUpdate {
  supabaseUserId?: string | null;
  shopDomain?: string;
  shopName?: string | null;
  email?: string;
  shopifyAccessTokenEncrypted?: string | null;
  birdChannelId?: string | null;
  whatsappPhoneNumber?: string | null;
  sesVerifiedDomain?: string | null;
  mollieCustomerId?: string | null;
  subscriptionTier?: "trial" | "starter" | "growth" | "scale";
  subscriptionStatus?: "trial" | "active" | "past_due" | "cancelled";
  trialEndsAt?: string | null;
  onboardingCompleted?: boolean;
  settings?: IMerchantSettings;
  googleAccessTokenEncrypted?: string | null;
  googleRefreshTokenEncrypted?: string | null;
  googleEmail?: string | null;
}
