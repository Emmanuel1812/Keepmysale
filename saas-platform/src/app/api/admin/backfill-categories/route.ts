import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";

export async function POST(request: Request) {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();

  // 1. Fetch conversations with NULL category
  const { data: convs, error: convError } = await supabase
    .from("conversations")
    .select("id, customer_id, customer:customers(name, email), metadata")
    .eq("merchant_id", merchantId)
    .is("category", null);

  if (convError) return apiError("INTERNAL_ERROR", convError.message, 500);
  if (!convs || convs.length === 0) return apiResponse({ success: true, updated: 0, message: "No conversations to backfill." });

  const financialKeywords = ["paypal", "google", "shopify", "paddle", "stripe", "mollie"];
  const spamKeywords = ["noreply", "no-reply", "newsletter", "marketing", "promo", "postmaster"];

  let updatedCount = 0;

  for (const c of convs) {
    let newCategory: string | null = null;
    
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const email = (customer?.email || "").toLowerCase();
    
    // 2. Check blocklist domains/prefixes
    const isFinancial = financialKeywords.some(k => email.includes(k));
    const isSpam = spamKeywords.some(k => email.includes(k));

    if (isFinancial) {
      newCategory = "financial";
    } else if (isSpam) {
      newCategory = "spam";
    } else {
      // 3. Fallback to extracting the latest message metadata intent
      const { data: messages } = await supabase
        .from("messages")
        .select("metadata")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      const lastMessage = messages?.[0];
      const intent = lastMessage?.metadata?.intent;
      
      if (intent === "wismo" || intent === "resend_confirmation") newCategory = "shipping";
      else if (intent === "return" || intent === "exchange") newCategory = "returns";
      else if (intent === "faq") newCategory = "product";
    }

    if (newCategory) {
      await supabase
        .from("conversations")
        .update({ category: newCategory })
        .eq("id", c.id);
      updatedCount++;
    }
  }

  return apiResponse({ success: true, updated: updatedCount, message: `Backfilled ${updatedCount} conversations.` });
}
