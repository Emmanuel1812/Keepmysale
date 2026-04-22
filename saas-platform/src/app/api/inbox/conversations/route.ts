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
  const statusFilter = searchParams.get("status");
  
  // Custom query to fetch conversations and their customers
  let query = supabase
      .from("conversations")
      .select("*, customer:customers(name, email)")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });

  if (categoryFilter) {
      query = query.eq("category", categoryFilter);
  }

  if (statusFilter) {
      if (statusFilter === "resolved") {
          query = query.in("status", ["resolved", "closed"]);
      } else if (statusFilter === "needs_reply") {
          // Open conversations where last message was from customer
          query = query.not("status", "in", '("resolved","closed")')
                       .eq("last_message_sender_type", "customer");
      } else if (statusFilter === "drafts") {
          query = query.not("status", "in", '("resolved","closed")')
                       .eq("last_message_sender_type", "ai_draft");
      } else if (statusFilter === "ai_managed") {
          // We can't do complex ORs easily in simple postgrest chain for nested logic like 
          // (last_message_sender_type = ai OR status = negotiating)
          // We apply an OR filter format:
          query = query.not("status", "in", '("resolved","closed")')
                       .or("last_message_sender_type.eq.ai,status.eq.negotiating");
      }
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
