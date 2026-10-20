/**
 * Shopify's order "name" already carries the hash ("#1001"), so prefixing another "#" printed "##1001".
 * Show exactly one, whatever the store's order-number format is.
 */
export function orderLabel(orderNumber: string | null | undefined, fallbackId: string): string {
  const cleaned = (orderNumber ?? "").trim().replace(/^#+\s*/, "");
  return cleaned ? `#${cleaned}` : `#${fallbackId.slice(0, 8)}`;
}
