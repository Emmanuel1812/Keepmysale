import { format } from "date-fns";
import type { ActionResult } from "@/types/domain";
import { classifyIntent } from "@/services/intent-service";
import { fetchOrderByName } from "@/lib/shopify/client";

interface OrchestrationInput {
  merchantId: string;
  customerEmail: string;
  incomingText: string;
  orderNameGuess?: string;
  shopDomain: string;
  shopAccessToken: string;
}

export async function buildAutomatedAction(input: OrchestrationInput): Promise<ActionResult> {
  const intentResult = await classifyIntent(input.incomingText);

  if (intentResult.intent === "resend_confirmation") {
    return {
      action: "send_confirmation",
      messageBody:
        "Thanks for reaching out. I have resent your order confirmation to the email used at checkout.",
    };
  }

  if (intentResult.intent === "wismo" && input.orderNameGuess) {
    const order = await fetchOrderByName({
      shopDomain: input.shopDomain,
      accessToken: input.shopAccessToken,
      orderName: input.orderNameGuess,
    });

    if (order?.trackingNumber) {
      return {
        action: "send_tracking_status",
        messageBody: `Your order ${order.name} has tracking number ${order.trackingNumber}.`,
      };
    }
  }

  if (intentResult.intent === "return_request") {
    return {
      action: "offer_partial_refund",
      messageBody:
        "We can help right away. If you prefer, we can offer a partial refund to avoid return shipping delays.",
    };
  }

  return {
    action: "send_general_reply",
    messageBody: `Thanks for your message. We received your request on ${format(new Date(), "yyyy-MM-dd HH:mm")} and will respond shortly.`,
  };
}
