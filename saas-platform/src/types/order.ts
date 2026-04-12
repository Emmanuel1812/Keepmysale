export interface IOrder {
  id: string;
  merchantId: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string | null;
  customerId: string | null;
  email: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: string | null;
  currency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  trackingCompany: string | null;
  deliveredAt: string | null;
  proactiveCheckSent: boolean;
  paymentGateway: string | null;
  customerName?: string | null;
  syncedAt: string;
  lineItems: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderCreate {
  merchantId: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string | null;
  customerId?: string | null;
  email?: string | null;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  totalPrice?: number | null;
  currency?: string;
  lineItems?: Array<Record<string, unknown>>;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  trackingCompany?: string | null;
  deliveredAt?: string | null;
  paymentGateway?: string | null;
}

export interface IOrderUpdate extends Partial<IOrderCreate> {
  proactiveCheckSent?: boolean;
}
