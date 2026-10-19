/** The currency that most orders are in; the fallback when there are no orders yet. */
export function dominantCurrency(currencies: ReadonlyArray<string | null | undefined>, fallback = "EUR"): string {
  const counts = new Map<string, number>();
  for (const raw of currencies) {
    const code = (raw ?? "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/** "$", "€", "£"... for an ISO currency code, as the English locale writes it. */
export function currencySymbol(currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
