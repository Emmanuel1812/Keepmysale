import type { IMerchantSettings } from "@/types/merchant";

/**
 * Formats a raw AI-generated response into a professional customer service email.
 * Uses merchant settings for greeting style, sign-off, tone, and custom intro.
 * Supports Dutch (nl), English (en), and Portuguese (pt).
 */
export function formatEmailResponse(params: {
  customerName: string | null;
  aiResponse: string;
  storeName: string;
  language: "nl" | "en" | "pt" | string;
  settings?: Partial<IMerchantSettings>;
}): { text: string; html: string } {
  const lang = (params.language || "nl").toLowerCase();
  const name = params.customerName?.trim();
  const settings = params.settings;

  // ── Greeting ──────────────────────────────────────────────
  let greeting = "";
  const greetingStyle = settings?.greeting_style ?? "time_based";

  if (greetingStyle === "time_based") {
    const hour = new Date().getHours();
    const timeGreeting =
      lang === "en"
        ? hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        : lang === "pt"
          ? hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
          : hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";
    greeting = name ? `${timeGreeting} ${name},` : `${timeGreeting},`;
  } else if (greetingStyle === "always_formal") {
    switch (lang) {
      case "en":
        greeting = name ? `Dear ${name},` : "Dear customer,";
        break;
      case "pt":
        greeting = name ? `Prezado(a) ${name},` : "Prezado(a) cliente,";
        break;
      default:
        greeting = name ? `Geachte ${name},` : "Geachte klant,";
    }
  } else {
    // always_casual or default fallback
    switch (lang) {
      case "en":
        greeting = name ? `Hi ${name},` : "Hi there,";
        break;
      case "pt":
        greeting = name ? `Olá ${name},` : "Olá,";
        break;
      default:
        greeting = name ? `Hoi ${name},` : "Hoi,";
    }
  }

  // ── Custom intro (optional line after greeting) ───────────
  let customIntro = settings?.custom_intro?.trim() || "";
  if (customIntro.includes("[name customer]")) {
    const replacement = name && name !== "Klant" ? name : "";
    customIntro = customIntro.replace(/\[name customer\]/g, replacement).replace(/\s\s+/g, " ").trim();
  }

  // ── Sign-off ──────────────────────────────────────────────
  const storeSuffix = params.storeName || "Store";

  // Use merchant settings if provided, otherwise sensible defaults per language
  let signOffText = settings?.sign_off_text?.trim() || "";
  let signOffName = settings?.sign_off_name?.trim() || "";

  if (!signOffText) {
    switch (lang) {
      case "en":
        signOffText = "Kind regards,";
        break;
      case "pt":
        signOffText = "Com os melhores cumprimentos,";
        break;
      default:
        signOffText = "Met vriendelijke groet,";
    }
  }

  if (!signOffName) {
    switch (lang) {
      case "en":
        signOffName = `${storeSuffix} Customer Support`;
        break;
      case "pt":
        signOffName = `${storeSuffix} Apoio ao Cliente`;
        break;
      default:
        signOffName = `${storeSuffix} Klantenservice`;
    }
  }

  const closing = `${signOffText}\n${signOffName}`;

  // ── Required phrases (appended before sign-off) ───────────
  const requiredPhrases = (settings?.required_phrases ?? []).filter(Boolean);

  // ── Build plain text ──────────────────────────────────────
  let textBody = params.aiResponse.trim();

  // Sanity Strip: Remove AI-generated greetings or placeholders that leaked through
  const hallucinationPatterns = [
    /^(hallo|beste|geachte|hi|hoi|dear|hello|good (morning|afternoon|evening))\s+.*?[,.:!]\s*/i,
    /\[name customer\]/gi,
    /\[customer\]/gi,
    /(met vriendelijke groet|vriendelijke groeten|vriendelijke groet|kind regards|sincerely|best|best regards|regards|atenciosamente|com os melhores cumprimentos)[,.:!]*\s*.*$/i
  ];
  
  hallucinationPatterns.forEach(pattern => {
    textBody = textBody.replace(pattern, "").trim();
  });

  const parts = [greeting];
  if (customIntro) parts.push(customIntro);
  parts.push("", textBody);
  if (requiredPhrases.length > 0) {
    parts.push("", requiredPhrases.join("\n"));
  }
  parts.push("", closing);
  const text = parts.join("\n");

  // ── Build HTML ────────────────────────────────────────────
  const htmlBody = textBody
    .split(/\n\n+/)
    .map((para) => para.replace(/\n/g, "<br>"))
    .map((para) => `<p style="margin-bottom: 16px;">${para}</p>`)
    .join("");

  const htmlClosing = closing.replace(/\n/g, "<br>");
  const htmlIntro = customIntro
    ? `<p style="margin-bottom: 16px; color: #555;">${customIntro}</p>`
    : "";
  const htmlRequired = requiredPhrases.length > 0
    ? `<p style="margin-bottom: 16px; color: #555; font-size: 13px;">${requiredPhrases.join("<br>")}</p>`
    : "";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <p style="margin-bottom: 16px;">${greeting}</p>
  ${htmlIntro}
  ${htmlBody}
  ${htmlRequired}
  <div style="margin-top: 24px; color: #666;">
    ${htmlClosing}
  </div>
</div>`.trim();

  return { text, html };
}
