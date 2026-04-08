import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <p className="text-sm font-medium">Merchant Dashboard</p>
      <Badge>Email-first</Badge>
    </header>
  );
}
