import type { SupabaseClient } from "@supabase/supabase-js";
import type { IIntentStructuredResult } from "@/types/ai";
import { format } from "date-fns";
import { OrderService } from "@/services/order-service";
import type { ActionResult } from "@/types/domain";
import type { IMerchantSettings } from "@/types/merchant";
import { createOpenAiClient } from "@/lib/openai/client";
import { INTENT_STRUCTURED_PROMPT, INTENT_SYSTEM_PROMPT } from "@/lib/openai/prompts";

const resendPatterns = [
  /resend.*confirmation/i,
  /didn'?t receive.*confirmation/i,
  /nao recebi.*confirmacao/i,
  /não recebi.*confirmação/i,
  /geen bevestigingsmail ontvangen/i,
  /bevestiging.*opnieuw sturen/i,
];

const wismoPatterns = [/where.*order/i, /tracking/i, /status.*order/i, /onde.*encomenda/i];
const returnPatterns = [/return/i, /refund/i, /damaged/i, /troca/i, /devolver/i];

export class AiService {
  private readonly orderService: OrderService;
  private readonly openAiClient = createOpenAiClient();

  constructor(private readonly supabase: SupabaseClient) {
    this.orderService = new OrderService(supabase);
  }

  async classifyIntent(text: string): Promise<IIntentStructuredResult> {
    if (resendPatterns.some((pattern) => pattern.test(text))) {
      return {
        intent: "resend_confirmation",
        confidence: 0.98,
        extracted_order_number: null,
        language_detected: "other",
        sentiment: "neutral",
        requires_human: false,
        reasoning: "High-confidence resend confirmation regex match.",
      };
    }

    const likelyWismo = wismoPatterns.some((pattern) => pattern.test(text));
    const likelyReturn = returnPatterns.some((pattern) => pattern.test(text));
    if (likelyWismo && /#?\d{3,}/.test(text)) {
      return {
        intent: "wismo",
        confidence: 0.96,
        extracted_order_number: (text.match(/#?\d{3,}/)?.[0] ?? null) as string | null,
        language_detected: "other",
        sentiment: "neutral",
        requires_human: false,
        reasoning: "High-confidence WISMO regex with order number.",
      };
    }
    if (likelyReturn && /(full return|devolver|retour)/i.test(text)) {
      return {
        intent: "return",
        confidence: 0.96,
        extracted_order_number: (text.match(/#?\d{3,}/)?.[0] ?? null) as string | null,
        language_detected: "other",
        sentiment: "negative",
        requires_human: false,
        reasoning: "High-confidence return request regex.",
      };
    }

    try {
      const completion = await this.openAiClient.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INTENT_SYSTEM_PROMPT },
          { role: "system", content: INTENT_STRUCTURED_PROMPT },
          { role: "user", content: text },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as IIntentStructuredResult;
      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        extracted_order_number: parsed.extracted_order_number ?? null,
        language_detected: parsed.language_detected ?? "other",
        sentiment: parsed.sentiment ?? "neutral",
        requires_human: parsed.requires_human ?? false,
        reasoning: parsed.reasoning ?? "Model classification output.",
      };
    } catch {
      return {
        intent: "other",
        confidence: 0.2,
        extracted_order_number: null,
        language_detected: "other",
        sentiment: "neutral",
        requires_human: true,
        reasoning: "OpenAI classification unavailable fallback.",
      };
    }
  }

  async buildAutomatedAction(input: {
    incomingText: string;
    orderNameGuess?: string;
    shopDomain: string;
    shopAccessToken: string;
    merchantSettings: IMerchantSettings;
  }): Promise<ActionResult> {
    const intentResult = await this.classifyIntent(input.incomingText);
    const preferredLanguage = input.merchantSettings.language ?? "nl";

    const messagesByLanguage = {
      nl: {
        resend:
          "Bedankt voor je bericht. We hebben de bestelbevestiging opnieuw gestuurd naar het e-mailadres van je bestelling.",
        tracking: (orderName: string, trackingNumber: string) =>
          `Je bestelling ${orderName} heeft trackingnummer ${trackingNumber}.`,
        negotiation:
          "We kunnen je direct helpen. Als je wilt, kunnen we een gedeeltelijke terugbetaling aanbieden om een retourzending te vermijden.",
        general: `Bedankt voor je bericht. We hebben je aanvraag ontvangen op ${format(new Date(), "yyyy-MM-dd HH:mm")} en reageren zo snel mogelijk.`,
      },
      en: {
        resend:
          "Thanks for your message. We have resent the order confirmation to the email used at checkout.",
        tracking: (orderName: string, trackingNumber: string) =>
          `Your order ${orderName} has tracking number ${trackingNumber}.`,
        negotiation:
          "We can help right away. If you prefer, we can offer a partial refund to avoid return shipping delays.",
        general: `Thanks for your message. We received your request on ${format(new Date(), "yyyy-MM-dd HH:mm")} and will respond shortly.`,
      },
      pt: {
        resend:
          "Obrigado pela sua mensagem. Reenviamos a confirmação da encomenda para o email usado na compra.",
        tracking: (orderName: string, trackingNumber: string) =>
          `A sua encomenda ${orderName} tem o número de seguimento ${trackingNumber}.`,
        negotiation:
          "Podemos ajudar já. Se preferir, podemos oferecer um reembolso parcial para evitar devolução.",
        general: `Obrigado pela sua mensagem. Recebemos o seu pedido em ${format(new Date(), "yyyy-MM-dd HH:mm")} e responderemos em breve.`,
      },
    } as const;

    const localText =
      preferredLanguage === "en"
        ? messagesByLanguage.en
        : preferredLanguage === "pt"
          ? messagesByLanguage.pt
          : messagesByLanguage.nl;

    if (intentResult.intent === "resend_confirmation") {
      return {
        action: "send_confirmation",
        messageBody: localText.resend,
      };
    }

    const orderNumberCandidate = input.orderNameGuess ?? intentResult.extracted_order_number ?? undefined;
    if (intentResult.intent === "wismo" && orderNumberCandidate) {
      const order = await this.orderService.fetchShopifyOrderByName(
        input.shopDomain,
        input.shopAccessToken,
        orderNumberCandidate,
      );
      if (order?.trackingNumber) {
        return {
          action: "send_tracking_status",
          messageBody: localText.tracking(order.name, order.trackingNumber),
        };
      }
    }

    if (intentResult.intent === "return") {
      return {
        action: "offer_partial_refund",
        messageBody: localText.negotiation,
      };
    }

    return {
      action: "send_general_reply",
      messageBody: localText.general,
    };
  }
}
