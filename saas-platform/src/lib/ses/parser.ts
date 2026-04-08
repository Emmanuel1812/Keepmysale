import type { ISesInboundMessage } from "@/types/ses";

export function parseSesInboundPayload(payload: unknown): ISesInboundMessage {
  const record = payload as {
    messageId: string;
    from: string;
    to: string;
    subject: string;
    textBody: string;
    merchantId: string;
  };

  return {
    messageId: record.messageId,
    from: record.from,
    to: record.to,
    subject: record.subject,
    textBody: record.textBody,
    merchantId: record.merchantId,
  };
}
