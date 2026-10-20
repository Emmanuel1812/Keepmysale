import { apiError, apiResponse } from "@/lib/api-helpers";
import { getMerchantFromSession } from "@/lib/auth";
import { getValidAccessToken, listRecentInboxMessageIds } from "@/lib/gmail/client";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/order-service";
import { dominantCurrency } from "@/lib/money";

export const dynamic = "force-dynamic";

/** The ids of the merchant's recent inbox mail, for the replay to walk through. Reads only. */
export async function GET() {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  if (!merchant.googleEmail || !merchant.googleAccessTokenEncrypted) {
    return apiError("GMAIL_NOT_CONNECTED", "Connect Gmail in Settings to run the replay.", 400);
  }

  try {
    const accessToken = await getValidAccessToken(merchant);
    const [ids, orders] = await Promise.all([
      listRecentInboxMessageIds(accessToken, 50),
      new OrderService(createSupabaseServiceClient()).findByMerchant(merchant.id),
    ]);
    // The store's own currency, so an empty replay does not show euros for a dollar shop
    return apiResponse({ ids, mailbox: merchant.googleEmail, currency: dominantCurrency(orders.map((o) => o.currency)) });
  } catch (error) {
    console.error("[replay/messages] Gmail list failed:", error instanceof Error ? error.message : error);
    return apiError("GMAIL_ERROR", "Could not read the mailbox. Reconnect Gmail in Settings and try again.", 502);
  }
}
