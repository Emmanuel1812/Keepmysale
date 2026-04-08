import { NavItem } from "@/components/layout/nav-item";
import { getMerchantFromSession } from "@/lib/auth";

export async function Sidebar() {
  let showOnboarding = true;
  try {
    const merchant = await getMerchantFromSession();
    showOnboarding = !merchant.onboardingCompleted;
  } catch {}

  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 md:block">
      <h2 className="mb-4 text-lg font-semibold">ReturnShield</h2>
      <nav className="flex flex-col gap-1">
        <NavItem href="/dashboard" label="Overview" />
        <NavItem href="/dashboard/inbox" label="Inbox" />
        <NavItem href="/dashboard/orders" label="Orders" />
        <NavItem href="/dashboard/returns" label="Returns" />
        <NavItem href="/dashboard/settings" label="Settings" />
        {showOnboarding && <NavItem href="/onboarding" label="Onboarding" />}
      </nav>
    </aside>
  );
}
