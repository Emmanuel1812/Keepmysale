import { apiError, apiResponse } from "@/lib/api-helpers";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getGmailMessage, getValidAccessToken } from "@/lib/gmail/client";
import { decryptAes256 } from "@/lib/encryption";
import { EmailFilterService } from "@/lib/services/email-filter";
import { AiService } from "@/services/ai-service";
import { OrderService } from "@/services/order-service";
import { analyzeEmail, REPLAY_MAX_IDS_PER_REQUEST as MAX_IDS_PER_REQUEST, type ReplayItem } from "@/services/replay-service";

export const dynamic = "force-dynamic";
// Each mail is up to two AI calls; the page sends a few ids at a time so one request stays well inside this.
export const maxDuration = 60;

const GMAIL_ID = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * What Keepmysale would have done with these mails. Nothing is sent, stored or labelled; the only possible write is
 * the Gmail access-token refresh that any Gmail read can trigger.
 */
export async function POST(request: Request) {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids : null;
  if (!ids || ids.length === 0 || ids.length > MAX_IDS_PER_REQUEST || !ids.every((id) => typeof id === "string" && GMAIL_ID.test(id))) {
    return apiError("VALIDATION_ERROR", `Send 1 to ${MAX_IDS_PER_REQUEST} Gmail message ids`, 400);
  }
  if (!merchant.googleEmail || !merchant.googleAccessTokenEncrypted) {
    return apiError("GMAIL_NOT_CONNECTED", "Connect Gmail in Settings to run the replay.", 400);
  }

  const supabase = createSupabaseServiceClient();
  const aiService = new AiService(supabase);
  const filter = new EmailFilterService(supabase);
  const orders = await new OrderService(supabase).findByMerchant(merchant.id);
  const shopAccessToken = merchant.shopifyAccessTokenEncrypted ? decryptAes256(merchant.shopifyAccessTokenEncrypted) : "";
  const accessToken = await getValidAccessToken(merchant);

  const items: ReplayItem[] = [];
  for (const id of ids as string[]) {
    try {
      const email = await getGmailMessage(accessToken, id);
      items.push(
        await analyzeEmail(email, {
          settings: merchant.settings,
          orders,
          filter: (parsed, headers) => filter.shouldProcessEmail(parsed, headers, merchant.id),
          classify: (text) => aiService.classifyIntent(text),
          draft: ({ text, intent, customerName }) =>
            aiService.buildAutomatedAction({
              incomingText: text,
              precomputedIntent: intent,
              customerName,
              storeName: merchant.shopName || undefined,
              shopDomain: merchant.shopDomain,
              shopAccessToken,
              merchantSettings: merchant.settings,
              merchantId: merchant.id,
            }),
        }),
      );
    } catch (error) {
      items.push({
        id, from: "", subject: "", receivedAt: null, snippet: "", outcome: "error",
        reason: error instanceof Error ? error.message : "read_failed",
      });
    }
  }

  return apiResponse({ items });
}
