import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyApprovalToken } from "@/lib/automation/draft-approval";
import { MessagesDal } from "@/dal/messages";
import { SendButton } from "@/components/approve/send-button";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Approve reply · KeepMySale",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Opened from the "drafts waiting" mail on a phone. Opening it never sends anything (mail scanners open links);
 * the Send button posts to /api/approve/<token>, which comes back here with ?status=.
 */
export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;
  const claim = verifyApprovalToken(token);

  if (!claim) {
    return (
      <Shell>
        <Notice
          tone="muted"
          icon={<ClockIcon className="h-5 w-5" />}
          title="This link has expired"
          body="Approval links work for 7 days. The draft is still in your KeepMySale inbox."
        />
      </Shell>
    );
  }

  const supabase = createSupabaseServiceClient();
  const messages = new MessagesDal(supabase);
  const draft = await messages.findById(claim.messageId);

  if (!draft || draft.merchantId !== claim.merchantId) {
    return (
      <Shell>
        <Notice tone="muted" icon={<AlertIcon className="h-5 w-5" />} title="This draft no longer exists" body="It may have been deleted or replaced in the inbox." />
      </Shell>
    );
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, subject, customer:customers(email, name)")
    .eq("id", draft.conversationId)
    .single();
  const customerRow = conversation?.customer as unknown;
  const customer = (Array.isArray(customerRow) ? customerRow[0] : customerRow) as { email?: string | null; name?: string | null } | null;
  const who = customer?.name || customer?.email || "the customer";
  const inboxHref = `/dashboard/inbox/${draft.conversationId}`;

  if (draft.sender !== "ai_draft") {
    const sentNow = status === "sent";
    return (
      <Shell>
        <Notice
          tone="kept"
          icon={<CheckIcon className="h-5 w-5" />}
          title={sentNow ? `Sent to ${who}` : "This reply was already sent"}
          body={sentNow ? "The reply went out from your support inbox and is in the conversation." : "Nothing more to do here."}
        />
        <Link href={inboxHref} className="mt-4 block text-center text-sm font-semibold text-kept-strong hover:underline">
          Open the conversation
        </Link>
      </Shell>
    );
  }

  // The customer's last message before this draft: what the reply answers
  const thread = await messages.findByConversation(draft.conversationId);
  const asked = [...thread]
    .filter((m) => m.sender === "customer" && m.createdAt <= draft.createdAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .pop();

  return (
    <Shell>
      <header className="kms-enter mb-5" style={{ ["--i" as string]: 0 }}>
        <p className="text-[13px] text-muted">Reply waiting for your approval</p>
        <h1 className="mt-0.5 text-xl font-semibold leading-snug text-foreground">{conversation?.subject || "Customer message"}</h1>
        <p className="mt-1 text-sm text-muted">{customer?.email ?? who}</p>
      </header>

      {status === "error" ? (
        <div className="mb-4 rounded-[12px] bg-lost-soft p-3.5 text-[13px] text-lost ring-1 ring-inset ring-[#fbd0da]" role="alert">
          The reply could not be sent. Try again, or send it from the inbox.
        </div>
      ) : null}

      {asked ? (
        <section className="kms-enter mb-4" style={{ ["--i" as string]: 1 }}>
          <h2 className="mb-1.5 text-xs font-semibold text-muted">Customer wrote</h2>
          <div className="whitespace-pre-wrap rounded-[14px] bg-surface-2 p-4 text-[15px] leading-relaxed text-foreground ring-1 ring-inset ring-line">
            {asked.content.trim()}
          </div>
        </section>
      ) : null}

      <section className="kms-enter mb-6" style={{ ["--i" as string]: 2 }}>
        <h2 className="mb-1.5 text-xs font-semibold text-kept-strong">Your reply</h2>
        <div className="kms-card whitespace-pre-wrap p-4 text-[15px] leading-relaxed text-foreground">{draft.content.trim()}</div>
      </section>

      <form method="post" action={`/api/approve/${token}`} className="kms-enter sticky bottom-4" style={{ ["--i" as string]: 3 }}>
        <SendButton />
      </form>
      <Link href={inboxHref} className="mt-4 block text-center text-sm font-semibold text-muted hover:text-foreground">
        Edit in KeepMySale first
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-10 pt-6 sm:pt-10">
      <p className="mb-6 text-sm font-semibold tracking-tight text-foreground">KeepMySale</p>
      {children}
    </main>
  );
}

function Notice({ tone, icon, title, body }: { tone: "kept" | "muted"; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="kms-card kms-enter flex gap-3 p-5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone === "kept" ? "bg-kept-soft text-kept-strong" : "bg-surface-2 text-muted"}`}>{icon}</span>
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}
