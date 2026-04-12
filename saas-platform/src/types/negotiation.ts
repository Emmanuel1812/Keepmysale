export type TNegotiationStatus =
  | "initiated"
  | "offer_sent"
  | "offer_accepted"
  | "offer_rejected"
  | "escalated"
  | "return_initiated"
  | "completed"
  | "expired";

export interface INegotiationOffer {
  step: number;
  type: "partial_refund" | "store_credit" | "full_refund" | "exchange";
  percentage?: number;
  amount: number;
  currency: string;
  offered_at: string;
  response: "rejected" | "accepted" | "pending";
  responded_at?: string;
}

export interface INegotiation {
  id: string;
  merchantId: string;
  conversationId: string;
  customerId: string;
  orderId: string | null;
  status: TNegotiationStatus;
  currentStep: number;
  maxSteps: number;
  offers: INegotiationOffer[];
  productCost: number | null;
  estimatedReturnCost: number | null;
  finalRefundAmount: number | null;
  finalRefundType: "partial_refund" | "store_credit" | "full_refund" | "exchange" | null;
  savings: number | null;
  shopifyRefundId: string | null;
  returnReason: string | null;
  customerFeedback: string | null;
  auditPdfUrl: string | null;
  isManualRefundRequired: boolean;
  refundRejectionReason: string | null;
  generatedDiscountCode: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface INegotiationCreate {
  merchantId: string;
  conversationId: string;
  customerId: string;
  orderId?: string | null;
  status?: TNegotiationStatus;
  currentStep?: number;
  maxSteps?: number;
  offers?: INegotiationOffer[];
  productCost?: number | null;
  estimatedReturnCost?: number | null;
  finalRefundAmount?: number | null;
  finalRefundType?: "partial_refund" | "store_credit" | "full_refund" | "exchange" | null;
  shopifyRefundId?: string | null;
  returnReason?: string | null;
  customerFeedback?: string | null;
  isManualRefundRequired?: boolean;
  refundRejectionReason?: string | null;
  generatedDiscountCode?: string | null;
}

export interface INegotiationUpdate extends Partial<INegotiationCreate> {
  status?: TNegotiationStatus;
  completedAt?: string | null;
  auditPdfUrl?: string | null;
  savings?: number | null;
  generatedDiscountCode?: string | null;
}
