import { Badge } from "@/components/ui/badge";

export function FulfillmentBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <Badge className="!bg-zinc-200 !text-zinc-800 dark:!bg-zinc-800 dark:!text-zinc-300">Unknown</Badge>;
  }
  
  switch (status.toLowerCase()) {
    case "fulfilled":
      return <Badge className="!bg-green-100 !text-green-800 dark:!bg-green-900/30 dark:!text-green-400">Fulfilled</Badge>;
    case "unfulfilled":
      return <Badge className="!bg-yellow-100 !text-yellow-800 dark:!bg-yellow-900/30 dark:!text-yellow-400">Unfulfilled</Badge>;
    case "partial":
    case "partially_fulfilled":
      return <Badge className="!bg-orange-100 !text-orange-800 dark:!bg-orange-900/30 dark:!text-orange-400">Partial</Badge>;
    default:
      return <Badge className="!bg-zinc-200 !text-zinc-800 dark:!bg-zinc-800 dark:!text-zinc-300">{status}</Badge>;
  }
}

export function FinancialBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <Badge className="!bg-zinc-200 !text-zinc-800 dark:!bg-zinc-800 dark:!text-zinc-300">Unknown</Badge>;
  }

  switch (status.toLowerCase()) {
    case "paid":
      return <Badge className="!bg-green-100 !text-green-800 dark:!bg-green-900/30 dark:!text-green-400">Paid</Badge>;
    case "refunded":
      return <Badge className="!bg-red-100 !text-red-800 dark:!bg-red-900/30 dark:!text-red-400">Refunded</Badge>;
    case "partially_refunded":
      return <Badge className="!bg-orange-100 !text-orange-800 dark:!bg-orange-900/30 dark:!text-orange-400">Partial Refund</Badge>;
    default:
      return <Badge className="!bg-zinc-200 !text-zinc-800 dark:!bg-zinc-800 dark:!text-zinc-300">{status}</Badge>;
  }
}
