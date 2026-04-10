export interface EmailTemplateParams {
  customerName: string;
  body: string;
  storeName: string;
  supportEmail: string;
}

export function formatEmailResponse(params: EmailTemplateParams): { html: string; text: string } {
  const greeting = getGreeting();
  const customerName = params.customerName || "klant";

  const text = `${greeting} ${customerName},

${params.body}

Mocht je nog vragen hebben, neem gerust contact met ons op.

Met vriendelijke groet,
${params.storeName}
${params.supportEmail}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
      <p style="font-size: 16px;">${greeting} ${customerName},</p>
      <div style="font-size: 16px; margin: 20px 0;">
        ${params.body.replace(/\n/g, "<br>")}
      </div>
      <p style="font-size: 16px;">Mocht je nog vragen hebben, neem gerust contact met ons op.</p>
      <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        <p style="margin: 0; font-size: 16px;">Met vriendelijke groet,</p>
        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold;">${params.storeName}</p>
        <p style="margin: 0; font-size: 14px; color: #666;">
          <a href="mailto:${params.supportEmail}" style="color: #666; text-decoration: none;">${params.supportEmail}</a>
        </p>
      </div>
    </div>`;

  return { html, text };
}

function getGreeting(): string {
  // UTC adjust for NL (+2)
  const hour = new Date().getUTCHours();
  const nlHour = (hour + 2) % 24;
  
  if (nlHour < 12) return "Goedemorgen";
  if (nlHour < 18) return "Goedemiddag";
  return "Goedenavond";
}
