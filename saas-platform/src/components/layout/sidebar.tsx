import { NavItem } from "@/components/layout/nav-item";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_LINKS } from "@/components/layout/nav-links";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ConversationsDal } from "@/dal/conversations";
import { MessagesDal } from "@/dal/messages";
import { countUnanswered, deriveThreadStates } from "@/lib/inbox-visibility";
import Image from "next/image";
import logo from "@/app/logo.png";

function planLabel(tier?: string | null, status?: string | null) {
  if (status === "trial") return "Free trial";
  if (!tier) return "";
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan`;
}

export async function Sidebar() {
  // No placeholder shop name: if the session cannot be read, show nothing rather than someone else's store
  let shopName = "";
  let plan = "";

  let unanswered = 0;

  try {
    const merchant = await getMerchantFromSession();
    shopName = merchant?.shopName || merchant?.shopDomain?.replace(".myshopify.com", "") || "";
    plan = planLabel(merchant?.subscriptionTier, merchant?.subscriptionStatus);
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

  const badgeFor = (href: string) => (href === "/dashboard/inbox" && unanswered > 0 ? unanswered : undefined);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink px-3 py-5 text-white md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Image src={logo} alt="" width={32} height={32} className="rounded-[9px] bg-white p-1" />
          <span className="text-[17px] font-bold tracking-[-0.02em]">KeepMySale</span>
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} href={link.href} label={link.label} icon={link.icon} badge={badgeFor(link.href)} />
          ))}
        </nav>

        {shopName ? (
          <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-kept/20 text-[13px] font-bold uppercase text-kept-glow">
              {shopName.charAt(0)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-white">{shopName}</span>
              {plan ? <span className="text-xs text-slate-400">{plan}</span> : null}
            </span>
          </div>
        ) : null}
      </aside>

      <MobileNav shopName={shopName} inboxBadge={unanswered > 0 ? unanswered : undefined} />
    </>
  );
}
