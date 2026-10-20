import type { IMerchantSettings } from "@/types/merchant";

/**
 * "Writes in your voice": the merchant's own sent replies are read once, the AI describes how they write, and that
 * description goes into every reply prompt. Only the description and a few short excerpts are stored, never the mails.
 */
export interface VoiceProfile {
  /** How this shop writes, in plain words; the merchant can edit it in Settings */
  summary: string;
  /** "je" or "u" style, when the samples are Dutch */
  address?: "je" | "u" | null;
  /** Up to three short excerpts of the merchant's own wording */
  examples: string[];
  learnedAt: string;
  sampleCount: number;
}

export const VOICE_MIN_SAMPLES = 3;
export const VOICE_MAX_SAMPLES = 25;
const SUMMARY_MAX = 900;
const EXAMPLE_MAX = 280;

/** Lines from which on everything is the quoted mail being answered, in the languages the shops use. */
const QUOTE_STARTS = [
  /^On .+wrote:\s*$/i,
  /^Op .+(schreef|heeft het volgende geschreven).*:\s*$/i,
  /^Em .+escreveu:\s*$/i,
  /^-{2,}\s*(Original Message|Oorspronkelijk bericht|Mensagem original)\s*-{2,}/i,
  /^(From|Van|De):\s.+/i,
  /^_{10,}\s*$/,
];

/** The part of a sent mail the merchant actually wrote: no quoted thread, no ">" lines. */
export function extractOwnText(body: string): string {
  const lines = String(body ?? "").replace(/\r\n/g, "\n").split("\n");
  const own: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (QUOTE_STARTS.some((p) => p.test(trimmed))) break;
    if (trimmed.startsWith(">")) continue;
    own.push(line);
  }
  return own.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** Letters and digits only: the same text sent as HTML or plain, with or without the greeting, still compares equal. */
const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Sent mails worth learning from: written by a person (not one of our own AI replies or digests), long enough
 * to show a style, deduplicated. An AI reply is recognised by a stretch from the middle of its text, because
 * the greeting and sign-off around it are added separately and differ per mail.
 */
export function selectVoiceSamples(texts: string[], aiWritten: string[], systemSignOff?: string): string[] {
  const ai = aiWritten.map(letters).filter((t) => t.length >= 60).map((t) => t.slice(20, 80));
  const signOff = systemSignOff ? letters(systemSignOff) : "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const text = extractOwnText(raw);
    const key = normalize(text);
    if (key.length < 40 || seen.has(key)) continue;
    const flat = letters(text);
    if (ai.some((chunk) => flat.includes(chunk))) continue;
    if (signOff.length >= 8 && flat.includes(signOff)) continue;
    seen.add(key);
    out.push(text.length > 1500 ? text.slice(0, 1500) : text);
    if (out.length >= VOICE_MAX_SAMPLES) break;
  }
  return out;
}

export function buildVoiceLearningPrompt(samples: string[]): string {
  return `Hieronder staan e-mails die een webwinkel zelf aan klanten heeft gestuurd. Beschrijf HOE deze winkel schrijft,
zodat een assistent nieuwe antwoorden in precies dezelfde stem kan schrijven.

Beschrijf alleen de stijl, nooit klantgegevens, namen, ordernummers of bedragen:
- lengte en opbouw (kort en zakelijk, of uitgebreid)
- aanspreekvorm (je/jij of u) en hoe formeel
- warmte, humor, emoji, uitroeptekens
- woorden en zinnetjes die vaak terugkomen
Beschrijf NIET de aanhef en de afsluiting (zoals "Beste ..." of "Met vriendelijke groet"): die voegt het systeem zelf toe.

Geef JSON:
{
  "summary": "<4 tot 7 korte zinnen in het Nederlands, als instructie aan de schrijver: 'Schrijf kort en direct...'>",
  "address": "je" | "u" | null,
  "examples": ["<maximaal 3 korte letterlijke zinnen uit de mails die de stem goed laten zien, zonder namen of nummers>"]
}

E-MAILS:
${samples.map((s, i) => `--- ${i + 1} ---\n${s}`).join("\n\n")}`;
}

/** The AI's answer as a profile, clamped; null when it is unusable. */
export function parseVoiceProfile(raw: string, sampleCount: number, now = new Date()): VoiceProfile | null {
  let parsed: { summary?: unknown; address?: unknown; examples?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, SUMMARY_MAX) : "";
  if (summary.length < 20) return null;
  const examples = Array.isArray(parsed.examples)
    ? parsed.examples.filter((e): e is string => typeof e === "string" && e.trim().length > 0).slice(0, 3).map((e) => e.trim().slice(0, EXAMPLE_MAX))
    : [];
  const address = parsed.address === "je" || parsed.address === "u" ? parsed.address : null;
  return { summary, address, examples, learnedAt: now.toISOString(), sampleCount };
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: "professioneel, kalm en empathisch",
  friendly: "warm, vriendelijk en informeel",
  formal: "zeer formeel en zakelijk",
  casual: "casual, vrolijk en persoonlijk",
};

export function toneDescription(tone: string | undefined): string {
  return TONE_DESCRIPTIONS[tone ?? ""] ?? TONE_DESCRIPTIONS.professional;
}

/**
 * Everything the merchant set about HOW replies are written, for every reply prompt: the tone, the learned voice
 * (when switched on), and the Rules tab. Facts and safety rules elsewhere in the prompt always win over style.
 */
export function buildStyleBlock(ms: Partial<IMerchantSettings>): string {
  const lines: string[] = [];
  const voice = ms.voice_profile;
  if (ms.voice_enabled && voice?.summary) {
    lines.push(`SCHRIJFSTIJL VAN DEZE WINKEL (geleerd uit hun eigen e-mails; volg deze stem, maar feiten en regels gaan altijd voor):\n${voice.summary}`);
    if (voice.address) lines.push(`Spreek de klant aan met "${voice.address}" (alleen in het Nederlands).`);
    if (voice.examples?.length) lines.push(`Zo klinken ze, ter inspiratie (niet letterlijk overnemen):\n${voice.examples.map((e) => `- "${e}"`).join("\n")}`);
  } else {
    lines.push(`TONE-OF-VOICE: Wees ${toneDescription(ms.tone)}. Gebruik volledige, goed geformuleerde zinnen.`);
  }
  for (const r of ms.custom_rules ?? []) if (String(r).trim()) lines.push(`EXTRA REGEL: ${r}`);
  for (const t of ms.forbidden_topics ?? []) if (String(t).trim()) lines.push(`VERBODEN ONDERWERP (ga hier niet op in, zeg dat een collega het oppakt): ${t}`);
  for (const p of ms.forbidden_phrases ?? []) if (String(p).trim()) lines.push(`ZIN NOOIT GEBRUIKEN: "${p}"`);
  return lines.join("\n");
}
