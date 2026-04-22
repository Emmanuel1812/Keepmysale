export interface INegotiationStepConfig {
  step: number;
  type: "partial_refund" | "store_credit";
  percentage: number;
  label?: string;
}

/** @deprecated Use INegotiationStepConfig instead */
export type INegotiationOfferConfig = INegotiationStepConfig;

/**
 * Full merchant settings object as defined in the Settings & Agent Spec v1.0.
 * All 27 fields from the documentation are represented here.
 * Stored as JSONB in the `merchants.settings` column.
 */
export interface IMerchantSettings {
  // ── Language & Communication ───────────────────────────────────
  /** AI response language: nl, en, pt */
  language: string;
  /** Tone of voice: professional, friendly, formal, casual */
  tone: "professional" | "friendly" | "formal" | "casual";
  /** Greeting style: time_based, always_formal, always_casual */
  greeting_style: "time_based" | "always_formal" | "always_casual";
  /** Name used in sign-off, e.g. "Team Webshop X" */
  sign_off_name: string;
  /** Closing text, e.g. "Met vriendelijke groet," */
  sign_off_text: string;
  /** Fixed intro sentence after greeting (optional) */
  custom_intro: string;

  // ── Return Negotiation ─────────────────────────────────────────
  /** AI starts negotiation automatically on return intent */
  auto_negotiate: boolean;
  /** Steps with percentage and type per step */
  negotiation_steps: INegotiationStepConfig[];
  /** Maximum number of negotiation steps (1-3) */
  max_steps: number;
  /** Product categories excluded from negotiation */
  excluded_categories: string[];
  /** Keywords in product name that exclude from negotiation */
  excluded_keywords: string[];
  /** Minimum order value for negotiation (€) */
  min_order_value: number;
  /** Maximum percentage that may ever be offered */
  max_refund_percentage: number;
  /** AI creates drafts, merchant must approve */
  shadow_mode: boolean;

  // ── Automation & Escalation ────────────────────────────────────
  /** Auto-reply on WISMO (where is my order) */
  auto_reply_wismo: boolean;
  /** Auto-reply on general questions */
  auto_reply_general: boolean;
  /** Auto-reply on complaints (riskier) */
  auto_reply_complaint: boolean;
  /** Confidence below this value → escalate to human */
  requires_human_threshold: number;
  /** After how many rejected steps → start actual return */
  escalate_after_steps: number;
  /** Satisfaction check after delivery */
  proactive_check_enabled: boolean;
  /** Hours after delivery for proactive check */
  proactive_check_delay_hours: number;

  // ── Response Timing ────────────────────────────────────────────
  /** Delay in hours before AI sends response (0 = instant) */
  response_delay_hours: number;
  /** Business hours start (e.g. "09:00") */
  business_hours_start: string;
  /** Business hours end (e.g. "18:00") */
  business_hours_end: string;
  /** Timezone for business hours */
  business_hours_timezone: string;
  /** Whether to respond during weekends */
  business_hours_weekends: boolean;

  // ── Rules & Restrictions ───────────────────────────────────────
  /** Topics where AI should never respond (e.g. "legal", "court") */
  forbidden_topics: string[];
  /** Phrases AI may never use */
  forbidden_phrases: string[];
  /** Phrases AI must always mention (e.g. "BTW-factuur beschikbaar") */
  required_phrases: string[];
  /** Free-text rules for the AI prompt */
  custom_rules: string[];
  /** Email subjects where AI should never auto-reply */
  do_not_engage_subjects: string[];

  // ── Shopify & Order Info ───────────────────────────────────────
  /** Include tracking link in WISMO replies */
  include_tracking_in_wismo: boolean;
  /** Mention product list in WISMO replies */
  include_line_items_in_wismo: boolean;
  /** Currency for amounts in emails */
  currency_display: string;

  // ── Legacy / Extra (kept for backward compatibility) ───────────
  /** @deprecated migrated to auto_negotiate */
  return_negotiation_enabled?: boolean;
  /** @deprecated migrated to negotiation_steps */
  negotiation_offers?: INegotiationStepConfig[];
  /** Business hours (not in spec, kept for compat) */
  business_hours?: { start: string; end: string };
  /** Timezone (not in spec, kept for compat) */
  timezone?: string;
  /** @deprecated migrated to auto_reply_general */
  auto_respond?: boolean;
  /** Escalation email address (not in spec, kept for compat) */
  escalation_email?: string | null;
}

/**
 * Default settings for new merchants, matching the full spec.
 */
export const DEFAULT_MERCHANT_SETTINGS: IMerchantSettings = {
  // Language & Communication
  language: "nl",
  tone: "professional",
  greeting_style: "time_based",
  sign_off_name: "",
  sign_off_text: "Met vriendelijke groet,",
  custom_intro: "",

  // Return Negotiation
  auto_negotiate: true,
  negotiation_steps: [
    { step: 1, percentage: 20, type: "partial_refund", label: "Stap 1" },
    { step: 2, percentage: 35, type: "partial_refund", label: "Stap 2" },
    { step: 3, percentage: 50, type: "store_credit", label: "Stap 3" },
  ],
  max_steps: 3,
  excluded_categories: [],
  excluded_keywords: [],
  min_order_value: 0,
  max_refund_percentage: 50,
  shadow_mode: false,

  // Automation & Escalation
  auto_reply_wismo: true,
  auto_reply_general: true,
  auto_reply_complaint: false,
  requires_human_threshold: 0.6,
  escalate_after_steps: 3,
  proactive_check_enabled: false,
  proactive_check_delay_hours: 48,

  // Response Timing
  response_delay_hours: 0,
  business_hours_start: "09:00",
  business_hours_end: "18:00",
  business_hours_timezone: "Europe/Amsterdam",
  business_hours_weekends: false,

  // Rules & Restrictions
  forbidden_topics: [],
  forbidden_phrases: [],
  required_phrases: [],
  custom_rules: [],
  do_not_engage_subjects: [],

  // Shopify & Order Info
  include_tracking_in_wismo: true,
  include_line_items_in_wismo: true,
  currency_display: "EUR",

  // Legacy compat
  business_hours: { start: "09:00", end: "17:00" },
  timezone: "Europe/Amsterdam",
  escalation_email: null,
};

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
