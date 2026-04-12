import type { SupabaseClient } from "@supabase/supabase-js";
import type { IIntentStructuredResult } from "@/types/ai";
import { format } from "date-fns";
import { OrderService } from "@/services/order-service";
import type { ActionResult } from "@/types/domain";
import type { IMerchantSettings } from "@/types/merchant";
import { createGeminiClient } from "@/lib/gemini/client";
import { INTENT_STRUCTURED_PROMPT, INTENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";

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
  private readonly geminiClient = createGeminiClient();

  constructor(private readonly supabase: SupabaseClient) {
    this.orderService = new OrderService(supabase);
  }

  async classifyIntent(text: string): Promise<IIntentStructuredResult> {
    console.log("[AI] Classifying text:", text.substring(0, 200));

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
      const model = this.geminiClient.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const prompt = `${INTENT_SYSTEM_PROMPT}\n${INTENT_STRUCTURED_PROMPT}\nCustomer Message: ${text}`;
      const result = await model.generateContent(prompt);
      const raw = result.response.text() || "{}";
      const parsed = JSON.parse(raw) as IIntentStructuredResult;

      console.log("[AI] Classification result:", JSON.stringify(parsed));
      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        extracted_order_number: parsed.extracted_order_number ?? null,
        language_detected: parsed.language_detected ?? "other",
        sentiment: parsed.sentiment ?? "neutral",
        requires_human: parsed.requires_human ?? false,
        reasoning: parsed.reasoning ?? "Gemini classification output.",
      };
    } catch (error) {
      console.error("[AI] Classification error:", error);
      return {
        intent: "other",
        confidence: 0.2,
        extracted_order_number: null,
        language_detected: "other",
        sentiment: "neutral",
        requires_human: true,
        reasoning: "Gemini classification unavailable fallback.",
      };
    }
  }

  async buildAutomatedAction(input: {
    incomingText: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    orderNameGuess?: string;
    customerName?: string;
    storeName?: string;
    shopDomain: string;
    shopAccessToken: string;
    merchantSettings: IMerchantSettings;
  }): Promise<ActionResult> {
    let intentResult: IIntentStructuredResult;
    const ms = input.merchantSettings;
    const preferredLanguage = ms.language ?? "nl";

    if (input.incomingText === "SYSTEM_GENERATE_PROACTIVE_CHECK") {
      intentResult = {
        intent: "other",
        confidence: 1.0,
        extracted_order_number: input.orderNameGuess || null,
        language_detected: (["nl", "en", "pt"].includes(preferredLanguage) ? preferredLanguage : "other") as any,
        sentiment: "positive",
        requires_human: false,
        reasoning: "System request for proactive satisfaction survey",
      };
    } else {
      intentResult = await this.classifyIntent(input.incomingText);
    }

    const customerName = input.customerName || "Klant";
    const storeName = input.storeName || input.shopDomain.replace(".myshopify.com", "");
    const currencyDisplay = ms.currency_display ?? "EUR";

    // ── Build settings-aware rules block for Gemini prompts ──
    const toneMap: Record<string, string> = {
      professional: "professioneel, kalm en empathisch",
      friendly: "warm, vriendelijk en informeel",
      formal: "zeer formeel en zakelijk",
      casual: "casual, vrolijk en persoonlijk",
    };
    const toneDescription = toneMap[ms.tone] ?? toneMap.professional;

    const settingsRulesBlock = [
      `TONE-OF-VOICE: Wees ${toneDescription}. Gebruik volledige, goed geformuleerde zinnen.`,
      ...(ms.custom_rules ?? []).map((r) => `EXTRA REGEL: ${r}`),
      ...(ms.forbidden_topics ?? []).map((t) => `VERBODEN ONDERWERP (reageer hier NOOIT op, escaleer in plaats daarvan): ${t}`),
      ...(ms.forbidden_phrases ?? []).map((p) => `ZIN NOOIT GEBRUIKEN: "${p}"`),
      ...(ms.required_phrases ?? []).map((p) => `ALTIJD VERMELDEN in je antwoord: "${p}"`),
    ].join("\n");

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

    console.log("[AI] Building action for intent:", intentResult.intent);

    let resultAction: ActionResult | null = null;

    if (intentResult.intent === "resend_confirmation") {
      resultAction = {
        action: "send_confirmation",
        messageBody: localText.resend,
      };
    }

    const orderNumberCandidate = input.orderNameGuess ?? intentResult.extracted_order_number ?? undefined;

    let orderContext = "Geen order gevonden.";
    let order: any = null;

    if (orderNumberCandidate) {
      order = await this.orderService.fetchShopifyOrderByName(
        input.shopDomain,
        input.shopAccessToken,
        orderNumberCandidate,
      );

      if (order) {
        const includeTracking = ms.include_tracking_in_wismo !== false;
        const includeLineItems = ms.include_line_items_in_wismo !== false;

        const lineItemsStr = includeLineItems
          ? (order.lineItems || [])
              .map((item: any) => `${item.quantity}x ${item.title}`)
              .join(", ")
          : "";

        const parts = [
          `Order ${order.shopifyOrderNumber || order.name}:`,
          `- Status: ${order.financialStatus}`,
          `- Fulfillment: ${order.fulfillmentStatus}`,
        ];
        if (includeTracking) parts.push(`- Tracking: ${order.trackingNumber || "geen"}`);
        if (includeLineItems && lineItemsStr) parts.push(`- Producten in deze order: ${lineItemsStr}`);
        parts.push(`- Totaal: ${order.totalPrice} ${currencyDisplay}`);

        orderContext = parts.join("\n          ");
      }
    }

    // Dynamic handling for WISMO or General if we have order context
    if (!resultAction && (intentResult.intent === "wismo" || intentResult.intent === "other")) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: "gemini-2.0-flash",
          generationConfig: { responseMimeType: "application/json" },
        });

        const prompt = `
        Je bent een klantenservice medewerker voor de webshop genaamd '${storeName}'. 
        Je spreekt de klant aan met '${customerName}'.
        
        RICHTLIJNEN VOOR JE ANTWOORD:
        1. BEGIN altijd met een vriendelijke groet gericht aan ${customerName}.
        2. ${settingsRulesBlock}
        3. ACCURAATHEID & SOURCE OF TRUTH: 
           - Als de klant vraagt naar de INHOUD van de order: som dan de items op uit de sectie 'Producten in deze order' in de context hieronder.
           - Als de klant vraagt naar de STATUS of TRACKING: geef dan het trackingnummer en de status (indien beschikbaar).
           - Gebruik ALTIJD de verstrekte Order Context.
        4. AFSLUITING: Eindig altijd met een professionele groet gevolgd door de naam van de shop: '${storeName}'.
        
        Taal: ${preferredLanguage}
        
        Order Context:
        ${orderContext}
        
        Klantvraag: ${input.incomingText}
        
        Return ONLY valid JSON:
        {
          "messageBody": "jouw volledige antwoord tekst hier (ZONDER aanhef en afsluiting, die worden apart toegevoegd)"
        }
        `;

        const response = await model.generateContent(prompt);
        const raw = response.response.text();
        const parsed = JSON.parse(raw);

        resultAction = {
          action: intentResult.intent === "wismo" ? "send_tracking_status" : "send_general_reply",
          messageBody: parsed.messageBody,
        };
      } catch (error) {
        console.error("[AI] Dynamic reply error:", error);
        // Fallback to static if it was wismo and we have tracking
        if (intentResult.intent === "wismo" && order?.trackingNumber) {
          resultAction = {
            action: "send_tracking_status",
            messageBody: `Beste ${customerName},\n\nJe bestelling ${order.name} heeft trackingnummer ${order.trackingNumber}.\n\nMet vriendelijke groet,\n${storeName}`,
          };
        }
      }
    }

    if (!resultAction && intentResult.intent === "return") {
      // Dynamic negotiation via Gemini
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: "gemini-2.0-flash",
          generationConfig: { responseMimeType: "application/json" },
        });

        const historyContext = (input.history || [])
          .map((h) => `${h.role === "user" ? "Klant" : "Assistent"}: ${h.content}`)
          .join("\n");

        const negotiationPrompt = `
        Je bent een klantenservice medewerker voor de webshop genaamd '${storeName}'. 
        Je spreekt de klant aan met '${customerName}'.

        De klant wil iets retourneren of is in gesprek over een retour.
        
        RICHTLIJNEN VOOR JE ANTWOORD:
        1. BEGIN altijd met een vriendelijke groet gericht aan ${customerName}.
        2. ${settingsRulesBlock}
        3. ACCURAATHEID & SOURCE OF TRUTH: 
           - Als de klant vraagt naar de INHOUD van de order: som dan de items op uit de sectie 'Producten in deze order' in de context hieronder.
           - Gebruik ALTIJD de verstrekte Order Context als bron van waarheid.
        4. STRATEGIE:
           - We proberen retouren te voorkomen door een gedeeltelijke terugbetaling (partial refund) aan te bieden.
           - De merchant heeft de volgende stappen ingesteld voor kortingen:
           ${(ms.negotiation_steps as any[] || [])
             .map((o) => `  * Stap ${o.step}: ${o.percentage}% ${o.type === "store_credit" ? "Store Credit" : "Terugbetaling"}`)
             .join("\n")}
           - Noem GEEN exacte percentages in je EERSTE aanbod tenzij de klant er specifiek om vraagt.
        5. AFSLUITING: Eindig altijd met een professionele groet gevolgd door de naam van de shop: '${storeName}'.

        Taal: ${preferredLanguage}
        
        Order Context:
        ${orderContext}

        Chatgeschiedenis:
        ${historyContext}
        
        Laatste bericht van de klant:
        ${input.incomingText}
        
        Opdracht: 
        1. Analyseer of de klant akkoord gaat met een aanbod ("accept"), het afwijst ("reject"), of dat we het gesprek moeten voortzetten ("continue").
        2. Schrijf een natuurlijk antwoord (ZONDER aanhef en afsluiting, die worden apart toegevoegd).
        
        Return ONLY valid JSON with this shape:
        {
          "messageBody": "jouw antwoord tekst hier (zonder aanhef en afsluiting)",
          "negotiationDecision": "accept" | "reject" | "continue"
        }
        `;

        const response = await model.generateContent(negotiationPrompt);
        const raw = response.response.text();
        const parsed = JSON.parse(raw) as { messageBody: string; negotiationDecision: "accept" | "reject" | "continue" };

        resultAction = {
          action: "offer_partial_refund",
          messageBody: parsed.messageBody || localText.negotiation,
          negotiationDecision: parsed.negotiationDecision || "continue",
        };
      } catch (error) {
        console.error("[AI] Dynamic negotiation error:", error);
        // Fallback to static
        resultAction = {
          action: "offer_partial_refund",
          messageBody: localText.negotiation,
          negotiationDecision: "continue",
        };
      }
    }

    if (!resultAction) {
      resultAction = {
        action: "send_general_reply",
        messageBody: localText.general,
      };
    }

    console.log("[AI] Action result:", resultAction.action, resultAction.messageBody?.substring(0, 200));
    return resultAction;
  }
}
