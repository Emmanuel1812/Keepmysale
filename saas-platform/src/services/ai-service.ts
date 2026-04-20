import type { SupabaseClient } from "@supabase/supabase-js";
import type { IIntentStructuredResult } from "@/types/ai";
import { format } from "date-fns";
import { OrderService } from "@/services/order-service";
import type { ActionResult } from "@/types/domain";
import type { IMerchantSettings } from "@/types/merchant";
import { createGeminiClient, GEMINI_MODELS, callGeminiWithRetry } from "@/lib/gemini/client";
import { createGroqClient, GROQ_MODELS, callGroqWithRetry } from "@/lib/ai/groq-client";
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
    activeNegotiation?: any;
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
      const assistantMsgs = input.history?.filter(h => h.role === 'assistant') || [];
      const lastAssistantMsg = assistantMsgs[assistantMsgs.length - 1];
      
      const isNegotiating = lastAssistantMsg?.content.includes('%') || 
                           lastAssistantMsg?.content.toLowerCase().includes('terugbetaling') ||
                           lastAssistantMsg?.content.toLowerCase().includes('tegoed');
      
      console.log(`[AI] Sticky Check: lastMsg="${lastAssistantMsg?.content.substring(0, 50)}...", isNegotiating=${isNegotiating}, currentIntent=${intentResult.intent}`);

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
        5. FORMATTING: Structureer je antwoord met lege regels (dubbele newlines \n\n) tussen alinea's. Schrijf NIET alles in één doorlopende alinea. Gebruik minimaal 2-3 korte alinea's. Bijvoorbeeld:
           - Alinea 1: Erken het probleem of de vraag van de klant
           - Alinea 2: Geef de relevante informatie of oplossing
           - Alinea 3: Bied verdere hulp aan of rond af
        6. SCHRIJFSTIJL:
           - Schrijf zoals een ervaren, vriendelijke klantenservice medewerker. NIET zoals een robot of AI.
           - Gebruik elk woord MAXIMAAL één keer per alinea. Herhaal NOOIT dezelfde term (zoals 'bestelling', 'status', 'informatie') meerdere keren in je bericht.
           - Houd het KORT. Maximaal 3-4 zinnen per alinea, maximaal 3 alinea's voor de body.
           - Wees direct. Geen opvulzinnen zoals 'we hopen dat dit u verder helpt' of 'aarzel niet om contact op te nemen'.
           - Eindig met een simpele, directe vraag als dat past. Bijvoorbeeld: 'Kan ik u verder nog ergens mee helpen?'
        
        CONTEXT:
        ${orderContext}
        
        KLANTBERICHT:
        "${input.incomingText}"
        
        ANTWOORD-FORMAT (JSON):
        {
          "messageBody": "<Schrijf hier je volledige, gedetailleerde antwoord MET dubbele newlines (\n\n) tussen alinea's. Geef specifieke uitleg over de status of beantwoord de vraag volledig. BELANGRIJK: Stop NOOIT midden in een zin. Maak je verhaal ALTIJD af.>"
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

        // --- STEP DETECTION LOGIC ---
        // Prioritize actual database state if passed in
        const steps = (ms.negotiation_steps as any[] || []).sort((a, b) => a.step - b.step);
        let currentStepIndex = -1;
        
        if (input.activeNegotiation && input.activeNegotiation.currentStep > 0) {
           currentStepIndex = steps.findIndex(s => s.step === input.activeNegotiation.currentStep);
        } else {
           // Fallback to text detection if no active DB negotiation yet
           const lastOfferedPct = this.detectLastOfferedPercentage(input.history || []);
           if (lastOfferedPct !== null) {
             currentStepIndex = steps.findIndex(s => s.percentage === lastOfferedPct);
           }
        }
        
        const nextStepIndex = Math.min(currentStepIndex + 1, steps.length - 1);
        const nextStep = steps[nextStepIndex];
        const isLastStep = currentStepIndex >= steps.length - 1;
        const currentActiveStep = currentStepIndex !== -1 ? steps[currentStepIndex] : null;

        const stepsContext = steps.length > 0
          ? `BESCHIKBARE STAPPEN CONFIGURATIE (Merchant instellingen):
${steps.map(s => `- Stap ${s.step}: ${s.percentage}% ${s.type === 'store_credit' ? 'Store Credit' : 'Terugbetaling'}`).join('\n')}

STRIKT_SYSTEEM_OVERRIDE:
- LAATST AANGEBODEN stap: ${currentActiveStep ? `Stap ${currentActiveStep.step} (${currentActiveStep.percentage}%) — dit is AL aangeboden en de klant reageert hier nu op` : "Geen — er is nog geen aanbod gedaan, dit wordt het EERSTE aanbod"}
- Huidige Stap-Index: ${nextStepIndex + 1} van de ${steps.length}
- JE MOET VOOR JE VOLGENDE AANBOD DIT GEBRUIKEN: ${nextStep ? nextStep.percentage + "% " + (nextStep.type === 'store_credit' ? 'Store Credit' : 'Terugbetaling') : "Geen"}
- Is dit de laatste stap? ${isLastStep ? "JA — de klant heeft zojuist ons LAATSTE en HOOGSTE aanbod afgewezen. Er zijn GEEN verdere stappen. Je MOET nu negotiationDecision op 'reject' zetten en de klant informeren dat je een menselijke collega inschakelt om de retour te verwerken. Bied GEEN nieuw percentage aan." : `NEE — er zijn nog stappen over. Je MOET nu exact ${nextStep?.percentage}% aanbieden als compensatie. Gebruik GEEN ander percentage. Zet negotiationDecision op 'next_step'.`}`
          : "Bied een kleine korting naar eigen inzicht om de retour te voorkomen (bijv. 15-20%).";

        const negotiationPrompt = `
        Je bent een ervaren klantenservice medewerker voor '${storeName}'. 
        
        NEGOTIATIE PROTOCOL (STRIKT):
        1. DOEL: Voorkom een retour door een compensatie aan te bieden uit de lijst hieronder. 
        2. TAAL: Reageer ALTIJD in het ${preferredLanguage}.
        3. GEEN GREETINGS/AFSLUITING: Schrijf alleen de inhoud van het bericht.
        4. FORMATTING: Structureer je antwoord met lege regels (dubbele newlines \n\n) tussen alinea's. Schrijf NIET alles in één doorlopende alinea. Gebruik minimaal 2-3 korte alinea's:
           - Alinea 1: Erken de onvrede van de klant en toon begrip
           - Alinea 2: Bied de compensatie/korting aan met duidelijke uitleg
           - Alinea 3: Vraag of dit een acceptabel alternatief is in plaats van een retour
        5. SCHRIJFSTIJL:
           - Schrijf zoals een ervaren, vriendelijke klantenservice medewerker. NIET zoals een robot of AI.
           - Gebruik elk woord MAXIMAAL één keer per alinea. Herhaal NOOIT dezelfde term (zoals 'compensatie', 'ontevredenheid', 'aanbod') meerdere keren in je bericht.
           - Houd het KORT. Maximaal 3-4 zinnen per alinea, maximaal 3 alinea's voor de body.
           - Wees direct. Geen opvulzinnen zoals 'we hopen dat dit meer in overeenstemming is met uw verwachtingen'.
           - Eindig met een simpele, directe vraag. Bijvoorbeeld: 'Zou dit voor u werken?' of 'Wat vindt u hiervan?'
           - NIET herhalen wat je al hebt aangeboden. Verwijs er kort naar ('de eerdere aanbiedingen') en ga direct naar het nieuwe aanbod.
        
        CRITICAL NEGOTIATION RULE: You must ONLY offer the exact compensation defined in the NEXT step. 
        DO NOT skip steps. DO NOT offer the maximum/hard limit unless it is explicitly the NEXT step.
        If the user rejects the current active step, you must ONLY offer the NEXT sequential step in your upcoming response. Do not invent your own percentages.
        
        STRATEGIE:
        Gespreksgeschiedenis:
        ${input.history ? input.history.map(h => `${h.role === 'user' ? 'Klant' : 'Assistent'}: ${h.content}`).join('\n') : 'Geen eerdere berichten.'}
        
        Laatste klantbericht: "${input.incomingText}"
        - Als ze ontevreden zijn of weigeren, bied dan de volgende stap aan uit de configuratie.
        - KIJK NAAR DE STRIKT_SYSTEEM_OVERRIDE: Als de database zegt dat we op Stap 1 zijn, bied dan nu Stap 2 aan. NIET HERHALEN wat je al hebt gezegd.
        - Ga pas over naar 'reject' (retour accepteren) als ALLES is afgewezen en er geen stappen meer zijn.
        ${stepsContext}
        
        BESLISSING ("negotiationDecision"):
        - "accept": Klant gaat expliciet akkoord met het huidge of eerder gedane aanbod.
        - "next_step": Klant weigert het huidige aanbod, we stellen nu de volgende stap (korting) voor. Gebruik dit ALTIJD als je een nieuw percentage aanbiedt uit de lijst.
        - "reject": Klant weigert het aanbod en er zijn geen stappen meer over (of klant is zo boos dat hij per se wil retourneren).
           BELANGRIJK BIJ "reject":
           - Herhaal GEEN enkel eerder aanbod of percentage.
           - Noem GEEN korting, compensatie, of percentage meer.
           - Erken de beslissing van de klant empathisch in 2-3 zinnen.
           - Vertel de klant dat een menselijke collega het overneemt om de retour te verwerken.
           - Voorbeeld: "Ik begrijp uw beslissing volledig. Ik schakel nu een collega in die u verder zal helpen met de retourprocedure. U hoort zo snel mogelijk van ons."
        - "continue": Klant stelt een algemene vraag, geeft verwarrende input, of we herhalen het bestaande scenario zonder een nieuwe stap aan te bieden.
        
        GESPREKSGESCHIEDENIS:
        ${historyContext}
        
        Stijl: ${toneDescription}.
        Context: ${orderContext}
        
        JSON Output:
        {
          "messageBody": "Schrijf hier je volledige, overtuigende antwoord MET dubbele newlines (\n\n) tussen alinea's. Stel de compensatie-stap voor of geef retour-instructies als alle stappen zijn doorlopen.",
          "negotiationDecision": "continue" | "accept" | "next_step" | "reject"
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
        const parsed = JSON.parse(resultStr) as { messageBody: string; negotiationDecision: "accept" | "reject" | "next_step" | "continue" };

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

        // HARD CHECK: If decision is "reject" but AI still mentions a percentage,
        // override with a clean handoff message to prevent repeated offers.
        if (parsed.negotiationDecision === 'reject' && finalMessage.includes('%')) {
          console.warn('[AI] REJECT SAFETY: AI returned reject but messageBody contains %. Overriding with clean handoff.');
          const lang = (preferredLanguage || 'nl').toLowerCase();
          if (lang === 'en') {
            finalMessage = "I completely understand your decision. I'm connecting you with a colleague who will help you with the return process. You'll hear from us shortly.";
          } else if (lang === 'pt') {
            finalMessage = "Compreendo perfeitamente a sua decisão. Vou encaminhá-lo para um colega que o ajudará com o processo de devolução. Entrará em contacto consigo em breve.";
          } else {
            finalMessage = "Ik begrijp uw beslissing volledig. Ik schakel nu een collega in die u verder zal helpen met de retourprocedure. U hoort zo snel mogelijk van ons.";
          }
        }

        resultAction = {
          action: "offer_partial_refund",
          messageBody: finalMessage,
          negotiationDecision: parsed.negotiationDecision || "continue",
        };
      } catch (error) {
        console.error("[AI] Dynamic negotiation error:", error instanceof Error ? error.message : error, error);
        
        // Smart fallback: if we know the next step, construct a proper offer message
        if (nextStep && !isLastStep) {
          const pct = nextStep.percentage;
          const typeLabel = nextStep.type === 'store_credit' ? 'store credit' : 'gedeeltelijke terugbetaling';
          resultAction = {
            action: "offer_partial_refund",
            messageBody: `Ik begrijp dat de eerdere aanbiedingen niet voldoende waren.\n\nAls volgende stap in ons compensatiebeleid kunnen wij een ${typeLabel} van ${pct}% van het aankoopbedrag aanbieden.\n\nZou dit voor u een acceptabel alternatief zijn in plaats van een retour?`,
            negotiationDecision: "next_step",
          };
        } else if (isLastStep) {
          // All steps exhausted — escalate to human
          resultAction = {
            action: "offer_partial_refund",
            messageBody: "Ik begrijp uw beslissing volledig. Ik schakel nu een collega in die u verder zal helpen met de retourprocedure. U hoort zo snel mogelijk van ons.",
            negotiationDecision: "reject",
          };
        } else {
          resultAction = {
            action: "offer_partial_refund",
            messageBody: localText.negotiation,
            negotiationDecision: "continue",
          };
        }
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
