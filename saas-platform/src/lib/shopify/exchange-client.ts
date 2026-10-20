import type { ExchangeState, VariantInfo } from "@/lib/automation/exchange";

/** Admin GraphQL version for exchanges (returnCreate with exchangeLineItems needs 2024-07 or later). */
export const SHOPIFY_GRAPHQL_VERSION = "2026-04";

/** What the automatic exchange needs on top of the app's base scopes. */
export const EXCHANGE_SCOPES = ["read_returns", "write_returns", "read_inventory"] as const;

type Fetch = typeof fetch;

async function graphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: Fetch = fetch,
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const res = await fetchImpl(`https://${shopDomain}/admin/api/${SHOPIFY_GRAPHQL_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}`);
  return (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
}

const gid = (kind: string, id: string | number) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/${kind}/${id}`);
const bare = (id: string) => id.split("/").pop() ?? id;

type VariantNode = {
  id: string;
  title: string;
  inventoryQuantity?: number | null;
  inventoryPolicy?: string | null;
  inventoryItem?: { tracked?: boolean | null } | null;
  selectedOptions?: Array<{ value: string }>;
};

/**
 * The product's sizes. With read_inventory we know the stock; without it the query is retried without stock
 * fields and `stockKnown` is false, so the reply never claims "in stock" for something we could not check.
 */
export async function fetchProductVariants(
  shopDomain: string,
  accessToken: string,
  productId: string,
  fetchImpl: Fetch = fetch,
): Promise<{ variants: VariantInfo[]; stockKnown: boolean }> {
  const withStock = `query($id: ID!) { product(id: $id) { variants(first: 50) { nodes { id title inventoryQuantity inventoryPolicy inventoryItem { tracked } selectedOptions { value } } } } }`;
  const withoutStock = `query($id: ID!) { product(id: $id) { variants(first: 50) { nodes { id title inventoryPolicy selectedOptions { value } } } } }`;
  const vars = { id: gid("Product", productId) };

  let result = await graphql<{ product: { variants: { nodes: VariantNode[] } } | null }>(shopDomain, accessToken, withStock, vars, fetchImpl);
  let stockKnown = true;
  if (result.errors?.length || !result.data?.product) {
    result = await graphql(shopDomain, accessToken, withoutStock, vars, fetchImpl);
    stockKnown = false;
  }
  const nodes = result.data?.product?.variants.nodes ?? [];
  return {
    stockKnown,
    variants: nodes.map((node) => ({
      id: bare(node.id),
      title: node.title,
      options: (node.selectedOptions ?? []).map((o) => o.value),
      inventoryQuantity: stockKnown ? node.inventoryQuantity ?? 0 : null,
      inventoryManagement: stockKnown ? (node.inventoryItem?.tracked ? "shopify" : null) : "unknown",
      inventoryPolicy: (node.inventoryPolicy ?? "deny").toLowerCase(),
    })),
  };
}

/** The scopes this shop actually granted us. */
export async function fetchGrantedScopes(shopDomain: string, accessToken: string, fetchImpl: Fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(`https://${shopDomain}/admin/oauth/access_scopes.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { access_scopes?: Array<{ handle: string }> };
  return (body.access_scopes ?? []).map((s) => s.handle);
}

export function hasExchangeScopes(granted: string[]): boolean {
  return ["read_returns", "write_returns"].every((scope) => granted.includes(scope));
}

/**
 * Records the return and the exchange in Shopify (returnCreate). Shopify emails the customer the return
 * details; the merchant processes it (returnProcess) when the item comes back, as with any Shopify return.
 */
export async function createExchangeReturn(
  shopDomain: string,
  accessToken: string,
  input: { orderId: string; returnVariantId: string; exchangeVariantId: string; reason: ExchangeState["reason"] },
  fetchImpl: Fetch = fetch,
): Promise<{ returnId: string }> {
  const lookup = await graphql<{
    returnableFulfillments: {
      nodes: Array<{ returnableFulfillmentLineItems: { nodes: Array<{ quantity: number; fulfillmentLineItem: { id: string; lineItem: { variant: { id: string } | null } } }> } }>;
    };
  }>(
    shopDomain,
    accessToken,
    `query($orderId: ID!) { returnableFulfillments(orderId: $orderId, first: 10) { nodes { returnableFulfillmentLineItems(first: 50) { nodes { quantity fulfillmentLineItem { id lineItem { variant { id } } } } } } } }`,
    { orderId: gid("Order", input.orderId) },
    fetchImpl,
  );
  if (lookup.errors?.length) throw new Error(lookup.errors.map((e) => e.message).join("; "));

  const candidates = (lookup.data?.returnableFulfillments.nodes ?? []).flatMap((f) => f.returnableFulfillmentLineItems.nodes);
  const line = candidates.find((c) => bare(c.fulfillmentLineItem.lineItem.variant?.id ?? "") === bare(input.returnVariantId) && c.quantity > 0);
  if (!line) throw new Error("No returnable fulfilled line item for this variant");

  const created = await graphql<{ returnCreate: { return: { id: string } | null; userErrors: Array<{ message: string }> } }>(
    shopDomain,
    accessToken,
    `mutation($input: ReturnInput!) { returnCreate(returnInput: $input) { return { id } userErrors { field message } } }`,
    {
      input: {
        orderId: gid("Order", input.orderId),
        returnLineItems: [
          {
            fulfillmentLineItemId: line.fulfillmentLineItem.id,
            quantity: 1,
            returnReason: input.reason,
            ...(input.reason === "OTHER" ? { returnReasonNote: "Exchange for another size (KeepMySale)" } : {}),
          },
        ],
        exchangeLineItems: [{ variantId: gid("ProductVariant", input.exchangeVariantId), quantity: 1 }],
        notifyCustomer: true,
      },
    },
    fetchImpl,
  );
  const errors = [...(created.errors ?? []).map((e) => e.message), ...(created.data?.returnCreate.userErrors ?? []).map((e) => e.message)];
  if (errors.length || !created.data?.returnCreate.return) throw new Error(errors.join("; ") || "returnCreate returned no return");
  return { returnId: created.data.returnCreate.return.id };
}
