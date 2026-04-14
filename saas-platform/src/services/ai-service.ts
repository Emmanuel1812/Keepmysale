import type { SupabaseClient } from "@supabase/supabase-js";
import type { IIntentStructuredResult } from "@/types/ai";
import { format } from "date-fns";
import { OrderService } from "@/services/order-service";
import type { ActionResult } from "@/types/domain";
import type { IMerchantSettings } from "@/types/merchant";
import { createGeminiClient, GEMINI_MODELS, callGeminiWithRetry } from "@/lib/gemini/client";
import { createGroqClient, GROQ_MODELS, callGroqWithRetry } from "@/lib/ai/groq-client";
import { INTENT_STRUCTURED_PROMPT, INTENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { INegotiation } from "@/types/negotiation";

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
  private readonly groqClient = createGroqClient();

  constructor(private readonly supabase: SupabaseClient) {
    this.orderService = new OrderService(supabase);
  }

  async classifyIntent(text: string, history?: Array<{ role: "user" | "assistant"; content: string }>): Promise<IIntentStructuredResult> {
    console.log("[AI] Classifying text with history context:", text.substring(0, 100));
    
    // Add history snippet to the prompt for better context if available
    const historySnippet = (history || [])
      .slice(-3)
      .map(h => `${h.role === 'user' ? 'Klant' : 'Assistent'}: ${h.content}`)
      .join('\n');

    const contextualPrompt = historySnippet 
      ? `GESPREKSGESCHIEDENIS:\n${historySnippet}\n\nNIEUW KLANTBERICHT: "${text}"`
      : `KLANTBERICHT: "${text}"`;

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
      const resultStr = await this.callResilientAi({
        gemini: {
          model: GEMINI_MODELS.PRIMARY,
          prompt: `${INTENT_SYSTEM_PROMPT}\n${INTENT_STRUCTURED_PROMPT}\n${contextualPrompt}`,
          jsonMode: true
        },
        groq: {
          messages: [
            { role: "system", content: `${INTENT_SYSTEM_PROMPT}\n${INTENT_STRUCTURED_PROMPT}` },
            { role: "user", content: contextualPrompt }
          ]
        }
      });

      const parsed = JSON.parse(resultStr) as IIntentStructuredResult;

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
    activeNegotiation?: INegotiation;
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
      intentResult = await this.classifyIntent(input.incomingText, input.history);
      
      // STICKY INTENT LOGIC:
      // If we are currently in an active return negotiation (history shows previous assistent refund offer)
      // and the current message is classified as 'other', 'complaint', or 'faq' with low confidence,
      // stick to 'return' intent to avoid breaking the negotiation flow.
      const lastAssistantMsg = input.history?.filter(h => h.role === 'assistant').slice(-1)[0];
      const isNegotiating = lastAssistantMsg?.content.includes('%') || lastAssistantMsg?.content.toLowerCase().includes('terugbetaling');
      
      if (isNegotiating && (intentResult.intent === 'other' || intentResult.intent === 'complaint' || intentResult.intent === 'faq')) {
        console.log(`[AI] Sticky Intent Triggered: Overriding ${intentResult.intent} with 'return' for negotiation continuity.`);
        intentResult.intent = 'return';
      }
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
    ].filter(Boolean).join("\n");

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
          ? (order.line_items || []) // Note: changed from .lineItems to match DAL/API conventions where possible, or just be safe
            .map((item: any) => `${item.quantity}x ${item.title}`)
            .join(", ")
          : "";

        const sanitize = (val: any) => (val === null || val === undefined || val === "undefined" ? "onbekend" : val);

        const parts = [
          `Order ${order.shopify_order_number || order.name || order.shopifyOrderId || "onbekend"}:`,
          `- Financiële Status: ${sanitize(order.financial_status || order.financialStatus)}`,
          `- Fulfillment Status: ${sanitize(order.fulfillment_status || order.fulfillmentStatus)}`,
        ];
        if (includeTracking) parts.push(`- Tracking: ${sanitize(order.tracking_number || order.trackingNumber)}`);
        if (includeLineItems && lineItemsStr) parts.push(`- Producten in deze order: ${lineItemsStr}`);
        parts.push(`- Totaal: ${order.totalPrice || order.total_price} ${currencyDisplay}`);

        orderContext = parts.join("\n          ");
      }
    }

    // Dynamic handling for WISMO, FAQ, Exchange, Return, or General/Other if we have order context
    const hasOrderContext = orderContext !== "Geen order gevonden.";
    
    if (!resultAction && (intentResult.intent === "wismo" || intentResult.intent === "faq" || intentResult.intent === "other")) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: GEMINI_MODELS.PRIMARY,
          generationConfig: { 
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            temperature: 0.7 
          },
        });

        const prompt = `
        Je bent een deskundige en behulpzame klantenservice medewerker voor '${storeName}'. 
        
        DOEL: Geef de klant een volledig, vriendelijk en accuraat antwoord op hun vraag.
        
        STRIKT PROTOCOL:
        1. TAAL: Reageer ALTIJD in het ${preferredLanguage}.
        2. VOLLEDIGHEID: Geef een compleet antwoord. Eindig nooit halverwege een zin.
        3. GEEN GREETINGS/AFSLUITING: Schrijf alleen de body van het bericht. Gebruik geen "Hoi", "Beste", of "Met vriendelijke groet".
        4. FAQ GEGEVENS: Als het intent van de klant algemeen/FAQ is en er is geen ordernummer verstrekt, vermeld dan NIET dat er geen order gevonden kon worden. Beantwoord gewoon hun vraag direct. Excuseer je nooit voor ontbrekende ordergegevens, tenzij de klant expliciet om een orderupdate (WISMO) vroeg en de order echt niet gevonden kan worden.
        
        CONTEXT:
        ${orderContext}
        
        KLANTBERICHT:
        "${input.incomingText}"
        
        ANTWOORD-FORMAT (JSON):
        {
          "messageBody": "<Schrijf hier je volledige, gedetailleerde antwoord. Geef specifieke uitleg over de status of beantwoord de vraag volledig. BELANGRIJK: Stop NOOIT midden in een zin. Maak je verhaal ALTIJD af.>"
        }
        `;

        const resultStr = await this.callResilientAi({
          gemini: {
            model: GEMINI_MODELS.PRIMARY,
            prompt,
            jsonMode: true,
            config: {
              maxOutputTokens: 2048,
              temperature: 0.7
            }
          },
          groq: {
            messages: [{ role: "user", content: prompt }]
          }
        });

        console.log("[AI] Raw dynamic reply:", resultStr);
        const parsed = JSON.parse(resultStr);

        resultAction = {
          action: (intentResult.intent === "wismo" || intentResult.intent === "faq") ? "send_tracking_status" : "send_general_reply",
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
          model: GEMINI_MODELS.PRIMARY,
          generationConfig: { 
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            temperature: 0.7 
          },
        });

        const historyContext = (input.history || [])
          .map((h) => `${h.role === "user" ? "Klant" : "Assistent"}: ${h.content}`)
          .join("\n");

        const steps = (ms.negotiation_steps as any[] || []).sort((a, b) => a.step - b.step);
        
        // --- STEP DETECTION LOGIC ---
        const lastOfferedPct = this.detectLastOfferedPercentage(input.history || []);
        
        // Use DB state if available, otherwise fallback to history detection
        let currentStepIndex = -1;
        if (input.activeNegotiation) {
          currentStepIndex = input.activeNegotiation.currentStep - 1; 
          console.log(`[AI] Using DB state: currentStep = ${input.activeNegotiation.currentStep}, index = ${currentStepIndex}`);
        } else if (lastOfferedPct !== null) {
          currentStepIndex = steps.findIndex(s => s.percentage === lastOfferedPct);
          console.log(`[AI] Using history state: lastPercentage = ${lastOfferedPct}, index = ${currentStepIndex}`);
        }

        const nextStepIndex = Math.min(currentStepIndex + 1, steps.length - 1);
        const nextStep = steps[nextStepIndex];
        
        // We are on the last step IF we just calculated the final available step AND we have a history of offering something before
        const isLastStep = nextStepIndex === steps.length - 1 && currentStepIndex !== -1;

        const stepsContext = steps.length > 0
          ? `BESCHIKBARE STAPPEN CONFIGURATIE:
${steps.map(s => `- Stap ${s.step}: ${s.percentage}% ${s.type === 'store_credit' ? 'Store Credit' : 'Terugbetaling'}`).join('\n')}

STATE:
- Laatst aangeboden percentage: ${lastOfferedPct !== null ? lastOfferedPct + "%" : "Geen"}
- DB Huidige Stap: ${input.activeNegotiation?.currentStep || "Geen"}
- VOLGENDE STAP OM AAN TE BIEDEN: Stap ${nextStepIndex + 1} (${nextStep ? nextStep.percentage + "% " + (nextStep.type === 'store_credit' ? 'Store Credit' : 'Terugbetaling') : "Geen"})
- Is dit de laatste mogelijkheid? ${isLastStep ? "JA. Als ze nu weigeren, MOET je overgaan naar 'reject'." : "NEE"}`
          : "Bied een kleine korting naar eigen inzicht om de retour te voorkomen (bijv. 15-20%).";

        const negotiationPrompt = `
        Je bent een ervaren klantenservice medewerker voor '${storeName}'. 
        
        NEGOTIATIE PROTOCOL (STRIKT):
        1. DOEL: Voorkom een retour door een compensatie aan te bieden uit de lijst hieronder. 
        2. TAAL: Reageer ALTIJD in het ${preferredLanguage}.
        3. GEEN GREETINGS/AFSLUITING: Schrijf alleen de inhoud van het bericht.
        
        CRITICAL NEGOTIATION RULE: You must ONLY offer the exact compensation defined in the CURRENT active step. 
        DO NOT skip steps. DO NOT offer the maximum/hard limit unless it is explicitly the current step.
        If the user rejects the current step, you must ONLY offer the NEXT sequential step in your upcoming response, or wait for system state updates. Do not invent your own percentages.
        
        STRATEGIE:
        Gespreksgeschiedenis:
        ${input.history ? input.history.map(h => `${h.role === 'user' ? 'Klant' : 'Assistent'}: ${h.content}`).join('\n') : 'Geen eerdere berichten.'}
        
        Laatste klantbericht: "${input.incomingText}"
        - Als ze ontevreden zijn, bied dan de volgende stap aan uit de lijst. 
        - KIJK NAAR DE GESCHIEDENIS: Als je in het vorige bericht 25% hebt aangeboden en de klant wijst het af, dan MOET je nu Stap 3 (35% korting) aanbieden. NIET HERHALEN wat je al hebt gezegd.
        - Ga pas over naar 'reject' (retour accepteren) als ALLES is afgewezen.
        ${stepsContext}
        
        BESLISSING ("negotiationDecision"):
        - "accept": Klant gaat akkoord met een eerder aanbod.
        - "next_step": Klant wijst het aanbod af, maar we hebben een VOLGENDE stap (zie STATE boven). Bied de volgende stap aan.
        - "reject": Klant wijst alles af OF we hebben geen stappen meer over. Accepteer de retour.
        - "continue": We stellen een verhelderende vraag zonder een nieuw aanbod te doen.
        
        GESPREKSGESCHIEDENIS:
        ${historyContext}
        
        Stijl: ${toneDescription}.
        Context: ${orderContext}
        
        JSON Output:
        {
          "messageBody": "Schrijf hier je overtuigende antwoord. Als je een nieuw aanbod doet (next_step), noem dan het percentage uit de 'VOLGENDE STAP'.",
          "negotiationDecision": "next_step" | "accept" | "reject" | "continue"
        }
        `;

        const resultStr = await this.callResilientAi({
          gemini: {
            model: GEMINI_MODELS.PRIMARY,
            prompt: negotiationPrompt,
            jsonMode: true,
            config: {
              maxOutputTokens: 2048,
              temperature: 0.7
            }
          },
          groq: {
            messages: [{ role: "user", content: negotiationPrompt }]
          }
        });

        console.log("[AI] Raw negotiation reply:", resultStr);
        const parsed = JSON.parse(resultStr) as { messageBody: string; negotiationDecision: "accept" | "reject" | "continue" };

        let finalMessage = parsed.messageBody;
        if (!finalMessage || finalMessage.trim().length < 5) {
          if (parsed.negotiationDecision === 'reject') {
            finalMessage = preferredLanguage === 'en' 
              ? "I understand. I will now hand you over to a human colleague to process your return labels."
              : "Ik begrijp het. Ik ga u nu overdragen aan een menselijke collega om uw retourlabels te verwerken.";
          } else {
            finalMessage = localText.negotiation;
          }
        }

        resultAction = {
          action: "offer_partial_refund",
          messageBody: finalMessage,
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

  private detectLastOfferedPercentage(history: Array<{ role: string; content: string }>): number | null {
    // Look for patterns like "20%", "20 %", "20 procent" in assistant messages, starting from the most recent
    const assistantMessages = history.filter(h => h.role === 'assistant').reverse();
    const pctRegex = /(\d{1,2})\s*(?:%|procent|percent)/i;
    
    for (const msg of assistantMessages) {
      const match = msg.content.match(pctRegex);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  }

  private async callResilientAi(options: {
    gemini: { 
      model: string; 
      prompt: string; 
      jsonMode?: boolean;
      config?: { maxOutputTokens?: number; temperature?: number; stopSequences?: string[] };
    };
    groq: { messages: any[]; model?: string };
  }): Promise<string> {
    // 1. Attempt Gemini
    try {
      const gModel = this.geminiClient.getGenerativeModel({
        model: options.gemini.model,
        generationConfig: {
          ...(options.gemini.jsonMode ? { responseMimeType: "application/json" } : {}),
          ...options.gemini.config,
        },
      });
      const result = await callGeminiWithRetry(gModel, options.gemini.prompt);
      const text = result.response.text();
      if (text) return text;
      throw new Error("Gemini returned empty response");
    } catch (geminiError: any) {
      console.error("[AI] Gemini failed, checking fallback:", geminiError.message || geminiError);
      
      // 2. Fallback to Groq if available
      if (this.groqClient) {
        try {
          console.log("[AI] Falling back to Groq...");
          const result = await callGroqWithRetry(
            this.groqClient,
            options.groq.messages,
            options.groq.model || GROQ_MODELS.PRIMARY
          );
          if (result) return result;
        } catch (groqError: any) {
          console.error("[AI] Groq fallback also failed:", groqError.message || groqError);
        }
      } else {
        console.warn("[AI] Groq fallback requested but GROQ_API_KEY is missing.");
      }
      
      // If we got here, both failed or fallback wasn't possible
      throw geminiError;
    }
  }
}
