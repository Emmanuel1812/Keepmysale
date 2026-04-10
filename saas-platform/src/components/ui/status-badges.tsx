import { Badge } from "@/components/ui/badge";

export function FulfillmentBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <Badge className="!bg-zinc-100 !text-zinc-600 border border-zinc-200">Unknown</Badge>;
  }
  
  switch (status.toLowerCase()) {
    case "fulfilled":
      return <Badge className="!bg-blue-50 !text-blue-700 border border-blue-200">Fulfilled</Badge>;
    case "unfulfilled":
      return <Badge className="!bg-yellow-50 !text-yellow-700 border border-yellow-200">Unfulfilled</Badge>;
    case "partial":
    case "partially_fulfilled":
      return <Badge className="!bg-orange-50 !text-orange-700 border border-orange-200">Partial</Badge>;
    default:
      return <Badge className="!bg-zinc-100 !text-zinc-600 border border-zinc-200">{status}</Badge>;
  }
}

export function FinancialBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <Badge className="!bg-zinc-100 !text-zinc-600 border border-zinc-200">Unknown</Badge>;
  }

  switch (status.toLowerCase()) {
    case "paid":
      return <Badge className="!bg-emerald-50 !text-emerald-700 border border-emerald-200">Paid</Badge>;
    case "refunded":
      return <Badge className="!bg-red-50 !text-red-700 border border-red-200">Refunded</Badge>;
    case "partially_refunded":
      return <Badge className="!bg-orange-50 !text-orange-700 border border-orange-200">Partial Refund</Badge>;
    default:
      return <Badge className="!bg-zinc-100 !text-zinc-600 border border-zinc-200">{status}</Badge>;
  }
}
