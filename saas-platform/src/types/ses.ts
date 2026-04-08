export interface ISesInboundMessage {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  textBody: string;
  merchantId: string;
}

export interface ISesOutboundMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface ISesSnsEnvelope {
  type: string;
  messageId: string;
  topicArn: string;
  message: string;
  timestamp: string;
  signature?: string;
}
