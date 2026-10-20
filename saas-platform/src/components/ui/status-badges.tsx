import { Badge } from "@/components/ui/badge";

// Colour = meaning: teal is done/kept, amber is waiting on someone, rose is money going back, grey is neutral.
const label = (status: string) => status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function FulfillmentBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge dot>Unknown</Badge>;

  switch (status.toLowerCase()) {
    case "fulfilled":
      return <Badge variant="teal" dot>Fulfilled</Badge>;
    case "unfulfilled":
      return <Badge variant="amber" dot>Unfulfilled</Badge>;
    case "partial":
    case "partially_fulfilled":
      return <Badge variant="amber" dot>Partial</Badge>;
    default:
      return <Badge dot>{label(status)}</Badge>;
  }
}

export function FinancialBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge dot>Unknown</Badge>;

  switch (status.toLowerCase()) {
    case "paid":
      return <Badge variant="teal" dot>Paid</Badge>;
    case "refunded":
      return <Badge variant="rose" dot>Refunded</Badge>;
    case "partially_refunded":
      return <Badge variant="amber" dot>Partial refund</Badge>;
    case "pending":
    case "authorized":
      return <Badge variant="amber" dot>{label(status)}</Badge>;
    default:
      return <Badge dot>{label(status)}</Badge>;
  }
}
