export interface IShopifyOrderSummary {
  id: string;
  name: string;
  email: string | null;
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
  totalPrice: string;
  currency: string;
  lineItems?: Array<any>;
  gateway: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface IShopifyOauthCallbackPayload {
  shop: string;
  code: string;
  hmac: string;
  state: string;
}

export interface IShopifyInstallResponse {
  installUrl: string;
  state: string;
}
