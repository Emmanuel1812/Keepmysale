import { NavItem } from "@/components/layout/nav-item";
import { getMerchantFromSession } from "@/lib/auth";
import Image from "next/image";
import logo from "@/app/logo.png";

export async function Sidebar() {
  let shopName = "efo-testing-store";
  let plan = "Starter Plan";

  try {
    const merchant = await getMerchantFromSession();
    if (merchant?.shopName) shopName = merchant.shopName;
  } catch {}

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[#1f2937] bg-[#111827] p-4 text-white md:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <Image src={logo} alt="KeepMySale Logo" width={32} height={32} className="rounded-md bg-white p-1" />
        <h2 className="text-xl font-bold tracking-tight">KeepMySale</h2>
      </div>
      
      <nav className="flex flex-1 flex-col gap-1">
        <NavItem href="/dashboard" label="Overview" />
        <NavItem href="/dashboard/inbox" label="Inbox" badge={3} />
        <NavItem href="/dashboard/orders" label="Orders" />
        <NavItem href="/dashboard/returns" label="Returns" />
        <NavItem href="/dashboard/settings" label="Settings" />
      </nav>
      
      <div className="mt-auto border-t border-zinc-800 pt-4 px-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">{shopName}</span>
          <span className="text-xs text-zinc-400">{plan}</span>
        </div>
      </div>
    </aside>
  );
}
