export interface IBirdInboundMessage {
  messageId: string;
  phone: string;
  body: string;
}

export interface IBirdOutboundMessage {
  to: string;
  body: string;
}

export interface IBirdWebhookEnvelope {
  eventId: string;
  timestamp: string;
  payload: IBirdInboundMessage;
}
