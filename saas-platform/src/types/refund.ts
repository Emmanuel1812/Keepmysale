import type { TConversationChannel } from "@/types/conversation";

export interface IRefundLog {
  id: string;
  merchantId: string;
  negotiationId: string | null;
  orderId: string | null;
  customerId: string | null;
  action: string;
  amount: string | null;
  currency: string;
  shopifyRefundId: string | null;
  shopifyTransactionId: string | null;
  channel: TConversationChannel | null;
  customerConsentRecorded: boolean;
  auditDetails: Record<string, unknown>;
  createdAt: string;
}

export interface IRefundLogCreate {
  merchantId: string;
  negotiationId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  action: string;
  amount?: number | null;
  currency?: string;
  shopifyRefundId?: string | null;
  shopifyTransactionId?: string | null;
  channel?: TConversationChannel | null;
  customerConsentRecorded?: boolean;
  auditDetails?: Record<string, unknown>;
}

export interface IRefundLogUpdate {
  action?: string;
  amount?: number | null;
  currency?: string;
  customerConsentRecorded?: boolean;
  auditDetails?: Record<string, unknown>;
}
