import { NavItem } from "@/components/layout/nav-item";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ConversationsDal } from "@/dal/conversations";
import { MessagesDal } from "@/dal/messages";
import { countUnanswered, deriveThreadStates } from "@/lib/inbox-visibility";
import Image from "next/image";
import logo from "@/app/logo.png";

export async function Sidebar() {
  let shopName = "efo-testing-store";
  let plan = "Starter Plan";

  let unanswered = 0;

  try {
    const merchant = await getMerchantFromSession();
    if (merchant?.shopName) shopName = merchant.shopName;
    // The Inbox badge is the real number of conversations waiting for an answer (it used to be a fixed 3).
    const db = createSupabaseServiceClient();
    // Both reads at once, and only who-wrote-when for the messages: this runs on every dashboard page.
    const [conversations, timeline] = await Promise.all([
      new ConversationsDal(db).findByMerchant(merchant.id),
      new MessagesDal(db).findTimelineByMerchant(merchant.id),
    ]);
    const states = deriveThreadStates(timeline);
    unanswered = countUnanswered(
      conversations.map((c) => ({
        ...c,
        lastMessageSenderType: states.get(c.id)?.lastSender ?? null,
        hasHumanReply: states.get(c.id)?.hasHumanReply ?? false,
      })),
    );
  } catch {}

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[#1f2937] bg-[#111827] p-4 text-white md:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <Image src={logo} alt="KeepMySale Logo" width={32} height={32} className="rounded-md bg-white p-1" />
        <h2 className="text-xl font-bold tracking-tight">KeepMySale</h2>
      </div>
      
      <nav className="flex flex-1 flex-col gap-1">
        <NavItem href="/dashboard" label="Overview" />
        <NavItem href="/dashboard/inbox" label="Inbox" badge={unanswered > 0 ? unanswered : undefined} />
        <NavItem href="/dashboard/orders" label="Orders" />
        <NavItem href="/dashboard/returns" label="Returns" />
        <NavItem href="/dashboard/replay" label="Inbox replay" />
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
