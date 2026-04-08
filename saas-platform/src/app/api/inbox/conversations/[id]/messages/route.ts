import { z } from "zod";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { InboxService } from "@/services/inbox-service";
import { ConversationService } from "@/services/conversation-service";
import { getMerchantFromSession } from "@/lib/auth";
import { assertOwnership } from "@/lib/ownership";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return apiError("VALIDATION_ERROR", "Invalid conversation id", 400, parsedParams.error.flatten());
  }

  const supabase = createSupabaseServiceClient();
  const conversationService = new ConversationService(supabase);
  const conversation = await conversationService.findById(parsedParams.data.id);
  if (!conversation) {
    return apiError("NOT_FOUND", "Resource not found", 404);
  }
  try {
    await assertOwnership(merchantId, conversation.merchantId);
  } catch {
    return apiError("NOT_FOUND", "Resource not found", 404);
  }

  const inboxService = new InboxService(supabase);
  const messages = await inboxService.getConversationMessages(parsedParams.data.id);
  return apiResponse({ messages });
}
