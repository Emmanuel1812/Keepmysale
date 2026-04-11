/**
 * Formats a raw AI-generated response into a professional customer service email.
 * Supports Dutch (nl), English (en), and Portuguese (pt).
 */
export function formatEmailResponse(params: {
  customerName: string | null;
  aiResponse: string;
  storeName: string;
  language: 'nl' | 'en' | 'pt' | string;
}): { text: string; html: string } {
  const lang = (params.language || 'nl').toLowerCase();
  const name = params.customerName?.trim();
  
  // Set greetings and closings based on language
  let greeting = '';
  let closing = '';
  const storeSuffix = params.storeName || 'Store';

  switch (lang) {
    case 'en':
      greeting = name ? `Hi ${name},` : "Hi there,";
      closing = `Kind regards,\n${storeSuffix} Customer Support`;
      break;
    case 'pt':
      greeting = name ? `Olá ${name},` : "Olá,";
      closing = `Com os melhores cumprimentos,\n${storeSuffix} Apoio ao Cliente`;
      break;
    case 'nl':
    default:
      greeting = name ? `Beste ${name},` : "Beste klant,";
      closing = `Met vriendelijke groet,\n${storeSuffix} Klantenservice`;
      break;
  }

  // PLAIN TEXT VERSION
  const textBody = params.aiResponse.trim();
  const text = `${greeting}\n\n${textBody}\n\n${closing}`;

  // HTML VERSION
  // Split by double newline for paragraphs, then join with <p> tags
  // Single newlines become <br>
  const htmlBody = textBody
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, '<br>'))
    .map(para => `<p style="margin-bottom: 16px;">${para}</p>`)
    .join('');

  const htmlClosing = closing.replace(/\n/g, '<br>');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <p style="margin-bottom: 16px;">${greeting}</p>
  ${htmlBody}
  <div style="margin-top: 24px; color: #666;">
    ${htmlClosing}
  </div>
</div>`.trim();

  return { text, html };
}
