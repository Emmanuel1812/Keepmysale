import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";

export async function GET(request: Request) {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const supabase = createSupabaseServiceClient();
  
  // Extract URL params
  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category");
  
  // Custom query to fetch conversations and their customers
  let query = supabase
      .from("conversations")
      .select("*, customer:customers(name, email)")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });

  if (categoryFilter) {
      query = query.eq("category", categoryFilter);
  }

  const { data: rawData, error } = await query;
      
  if (error) {
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  // Map back to standard response shape but include customer object
  const conversations = (rawData ?? []).map((row: any) => ({
    id: String(row.id),
    merchantId: String(row.merchant_id),
    customerId: String(row.customer_id),
    channel: row.channel,
    status: row.status,
    subject: row.subject ?? null,
    intent: row.intent ?? null,
    assignedTo: row.assigned_to ?? null,
    aiResolved: Boolean(row.ai_resolved),
    shopifyOrderId: row.shopify_order_id ?? null,
    lastMessageAt: String(row.last_message_at),
    lastMessageSenderType: row.last_message_sender_type ?? null,
    lastMessageContent: row.last_message_content ?? null,
    resolvedAt: row.resolved_at ?? null,
    metadata: row.metadata ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
  }));

  return apiResponse({ conversations });
}
