export interface ICustomer {
  id: string;
  merchantId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  shopifyCustomerId: string | null;
  language: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ICustomerCreate {
  merchantId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  shopifyCustomerId?: string | null;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface ICustomerUpdate {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  shopifyCustomerId?: string | null;
  language?: string;
  metadata?: Record<string, unknown>;
}
