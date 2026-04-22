import { SupabaseClient } from "@supabase/supabase-js";

export interface EmailHeader {
  name: string;
  value: string;
}

export interface ParsedEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export interface FilterResult {
  shouldProcess: boolean;
  reason: string;
  layer: number;
}

export class EmailFilterService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Main entry point for filtering emails.
   * Implements 4 layers of filtering: Sender, Subject, Headers, and Customer Match.
   */
  async shouldProcessEmail(
    email: ParsedEmail,
    headers: EmailHeader[],
    merchantId: string
  ): Promise<FilterResult> {
    const fromAddress = this.extractEmail(email.from);
    const fromLower = fromAddress.toLowerCase();
    const subject = email.subject || "";
    let knownCustomer: boolean | null = null; // null = not checked yet

    // --- LAYER 1: SENDER BLOCKLIST ---
    const skipDomains = [
      // Banks
      "ing.com", "ing.nl", "rabobank.nl", "abnamro.nl", "knab.nl", "bunq.com", 
      "revolut.com", "paypal.com", "paypal.nl", "stripe.com", "mollie.com", "adyen.com", "paddle.com",
      // Government/tax
      "belastingdienst.nl", "fiscaal-online.nl", "kvk.nl", "uwv.nl", "duo.nl",
      // Newsletter/marketing/System
      "mailchimp.com", "sendgrid.net", "amazonses.com", "campaign-monitor.com", 
      "hubspot.com", "klaviyo.com", "mailer.shopify.com", "shopify.com", "google.com", "googlemail.com", "amazon.com",
      // Other high-traffic spammy domains from previous version
      "uber.com", "tiktok.com", "facebook.com", "facebookmail.com", "instagram.com", 
      "twitter.com", "linkedin.com", "pinterest.com", "netlify.com", 
      "vercel.com", "github.com"
    ];

    // Transactional, marketing, and support prefixes
    const skipSenderRegex = /^(noreply-.*|noreply|no-reply|donotreply|mailer-daemon|postmaster|notifications?|alerts?|system|auto|bounce|updates?|billing|invoices?|newsletter|marketing|promo|info|support)/i;
    
    // Check domains
    if (skipDomains.some(d => fromLower.endsWith(`@${d}`) || fromLower.endsWith(`.${d}`))) {
      return { shouldProcess: false, reason: `Sender domain blocked: ${fromAddress}`, layer: 1 };
    }

    // Check transactional patterns
    if (skipSenderRegex.test(fromAddress)) {
      return { shouldProcess: false, reason: `Sender pattern blocked: ${fromAddress}`, layer: 1 };
    }

    // Special check for info@*.nl (only if not matching a customer) - removed local info@ check because the regex above catches it directly now.

    // --- LAYER 2: SUBJECT BLOCKLIST ---
    const bulkSubjectsRegex = /automatic reply|auto-reply|out of office|delivery status|undeliverable|mailer\.daemon|account.*(statement|update|security|verify)|nieuwsbrief|newsletter|aangifte|belasting|factuur van|your.*invoice|payment.*received|payment.*confirmation|abonnement|subscription|invoice|payment.*failed|betaling.*ontvangen|betaling.*mislukt|chargeback|your.*receipt|sent you money|heeft.*overgemaakt|betalingsgegevens|Update je betalingsgegevens|unsubscribe/i;
    
    if (bulkSubjectsRegex.test(subject)) {
      return { shouldProcess: false, reason: `Subject pattern blocked: ${subject}`, layer: 2 };
    }


    // --- LAYER 3: HEADER CHECK ---
    for (const header of headers) {
      const name = header.name.toLowerCase();
      const value = (header.value || "").toLowerCase();

      if (name === "auto-submitted" && value !== "no") {
        return { shouldProcess: false, reason: `Header Auto-Submitted: ${value}`, layer: 3 };
      }
      if (name === "list-unsubscribe") {
        return { shouldProcess: false, reason: `Header List-Unsubscribe found`, layer: 3 };
      }
      if (name === "x-auto-response-suppress") {
        return { shouldProcess: false, reason: `Header X-Auto-Response-Suppress found`, layer: 3 };
      }
      if (name === "precedence" && (value === "bulk" || value === "junk" || value === "list")) {
        return { shouldProcess: false, reason: `Header Precedence: ${value}`, layer: 3 };
      }
    }


    // --- LAYER 4: CUSTOMER MATCH ---
    if (knownCustomer === true) {
      return { shouldProcess: true, reason: "Matches existing customer order (cached from L1)", layer: 4 };
    }

    const { data: order, error } = await this.supabase
      .from("orders")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("email", fromLower) // Using 'email' column as found in DAL
      .maybeSingle();

    if (error) {
      console.error(`[EmailFilter] Error checking customer match:`, error);
      // If DB error, we still process but log it.
    }

    if (order) {
      return { shouldProcess: true, reason: "Matches existing customer order", layer: 4 };
    } else {
      console.warn(`[EmailFilter] Unknown sender, not matching any order customer: ${fromAddress}`);
      return { shouldProcess: true, reason: "Unknown sender, passing with warning", layer: 4 };
    }
  }

  /**
   * Helper to extract email address from "Name <email@domain.com>" format.
   */
  private extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/);
    if (match) return match[1].trim();
    return from.trim();
  }
}
