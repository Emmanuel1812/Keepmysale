import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";

export async function GET(req: Request) {
  let merchantId = "";
  let shopDomain = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
    shopDomain = merchant.shopDomain;
  } catch (err) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "active"; // "active", "accepted", "returns", "all"

  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("negotiations")
    .select(`
      *,
      order:orders(shopify_order_number, shopify_order_id, email, total_price, currency, line_items),
      customer:customers(name, email)
    `)
    .eq("merchant_id", merchantId)
    .order("updated_at", { ascending: false });

  if (tab === "active") {
    query = query.in("status", ["initiated", "offer_sent", "offer_rejected"]);
  } else if (tab === "accepted") {
    query = query.eq("status", "completed");
  } else if (tab === "returns") {
    query = query.eq("status", "return_initiated");
  }

  const { data: negs, error } = await query;
  if (error) {
    console.error("[returns GET] DB error:", error);
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  const enriched = negs.map((n: any) => {
    const orderData = Array.isArray(n.order) ? n.order[0] : n.order;
    const customerData = Array.isArray(n.customer) ? n.customer[0] : n.customer;

    return {
      id: n.id,
      status: n.status,
      currentStep: n.current_step,
      maxSteps: n.max_steps,
      offers: n.offers || [],
      savings: n.savings,
      shopifyRefundId: n.shopify_refund_id,
      refundProcessed: n.refund_processed,
      refundProcessedAt: n.refund_processed_at,
      returnStatus: n.return_status,
      completedAt: n.completed_at,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      
      orderNumber: orderData?.shopify_order_number || orderData?.shopify_order_id || "Unknown",
      shopifyOrderId: orderData?.shopify_order_id || null,
      customerName: customerData?.name || "Unknown",
      customerEmail: orderData?.email || customerData?.email || "Unknown",
      orderValue: orderData?.total_price || "0.00",
      currency: orderData?.currency || "EUR",
      lineItems: orderData?.line_items || [],
      shopDomain: shopDomain,
      
      conversationId: n.conversation_id
    };
  });

  // Calculate top-level KPIs based on all-time data securely by omitting tab filters
  const { data: allNegs } = await supabase
    .from("negotiations")
    .select("status, savings, refund_processed")
    .eq("merchant_id", merchantId);

  const kpis = {
    activeCount: 0,
    savedRevenue: 0,
    refundsIssued: 0,
    pendingReturns: 0
  };

  if (allNegs) {
    for (const neg of allNegs) {
      if (["initiated", "offer_sent", "offer_rejected"].includes(neg.status)) kpis.activeCount++;
      if (neg.status === "completed") {
        kpis.savedRevenue += Number(neg.savings || 0);
        if (neg.refund_processed) kpis.refundsIssued++;
      }
      if (neg.status === "return_initiated") kpis.pendingReturns++;
    }
  }

  return apiResponse({ 
    negotiations: enriched,
    kpis
  });
}
