import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConversationItem {
  id: string;
  customer: string;
  preview: string;
  status: string;
}

interface ConversationListProps {
  items: ConversationItem[];
}

export function ConversationList({ items }: ConversationListProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Link key={item.id} href={`/dashboard/inbox/${item.id}`}>
          <Card className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{item.customer}</p>
              <Badge>{item.status}</Badge>
            </div>
            <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{item.preview}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
