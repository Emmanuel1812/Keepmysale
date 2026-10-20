import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { deriveThreadStates } from "@/lib/inbox-visibility";

export async function GET(request: Request) {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const supabase = createSupabaseServiceClient();
  
  // Custom query to fetch conversations and their customers
  // The two reads are independent, so run them together.
  const conversationsQuery = supabase
      .from("conversations")
      .select("*, customer:customers(name, email)")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });
  // Who wrote last / has a person replied: derived from the messages (there is no such column).
  const messagesQuery = supabase
    .from("messages")
    .select("conversation_id, sender, created_at")
    .eq("merchant_id", merchantId);
  const [{ data: rawData, error }, { data: messageRows }] = await Promise.all([conversationsQuery, messagesQuery]);

  if (error) {
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  const threadStates = deriveThreadStates(
    (messageRows ?? []).map((m: any) => ({ conversationId: String(m.conversation_id), sender: String(m.sender), createdAt: String(m.created_at) })),
  );

  // Map back to standard response shape but include customer object
  const conversations = (rawData ?? []).map((row: any) => ({
    id: String(row.id),
    merchantId: String(row.merchant_id),
    customerId: String(row.customer_id),
    channel: row.channel,
    status: row.status,
    subject: row.subject ?? null,
    intent: row.intent ?? null,
    category: row.category ?? null,
    isKnownCustomer: Boolean(row.is_known_customer),
    assignedTo: row.assigned_to ?? null,
    aiResolved: Boolean(row.ai_resolved),
    shopifyOrderId: row.shopify_order_id ?? null,
    lastMessageAt: String(row.last_message_at),
    lastMessageSenderType: threadStates.get(String(row.id))?.lastSender ?? row.last_message_sender_type ?? null,
    hasHumanReply: threadStates.get(String(row.id))?.hasHumanReply ?? false,
    lastMessageContent: row.last_message_content ?? null,
    resolvedAt: row.resolved_at ?? null,
    metadata: row.metadata ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
  }));

  return apiResponse({ conversations });
}
