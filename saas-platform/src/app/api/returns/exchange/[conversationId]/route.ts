import { apiError, apiResponse } from "@/lib/api-helpers";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** The merchant marks an exchange as handled in Shopify. Only their own conversations. */
export async function POST(_req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  let merchantId = "";
  try {
    merchantId = (await getMerchantFromSession()).id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const { conversationId } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, metadata")
    .eq("id", conversationId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  const exchange = (conv?.metadata as Record<string, any> | null)?.exchange;
  if (!conv || !exchange) return apiError("NOT_FOUND", "Exchange not found", 404);

  const metadata = { ...(conv.metadata as Record<string, unknown>), exchange: { ...exchange, status: "done", updatedAt: new Date().toISOString() } };
  const { error } = await supabase.from("conversations").update({ metadata }).eq("id", conversationId).eq("merchant_id", merchantId);
  if (error) return apiError("DB_ERROR", error.message, 500);
  return apiResponse({ done: true });
}
