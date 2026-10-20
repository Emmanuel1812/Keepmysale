"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { REPLAY_MAX_IDS_PER_REQUEST, summarizeReplay, type ReplayItem, type ReplayOutcome } from "@/lib/replay/summary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Tabs } from "@/components/ui/page";
import { AlertIcon, ChatIcon, CoinsIcon, MailIcon, ReplayIcon, ShieldIcon } from "@/components/ui/icons";

type Phase = "idle" | "listing" | "analyzing" | "done" | "error";
type View = "customers" | "returns" | "skipped" | "all";

const OUTCOME: Record<ReplayOutcome, { label: string; variant: "teal" | "amber" | "default" | "rose" }> = {
  auto_reply: { label: "Would answer", variant: "teal" },
  draft: { label: "Draft for you", variant: "amber" },
  filtered: { label: "Skipped: not support mail", variant: "default" },
  not_customer: { label: "Skipped: never ordered", variant: "default" },
  error: { label: "Could not analyse", variant: "rose" },
};

const RATES = [
  { value: 0.25, label: "1 in 4" },
  { value: 1 / 3, label: "1 in 3" },
  { value: 0.5, label: "1 in 2" },
];

export default function ReplayPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ReplayItem[]>([]);
  const [rate, setRate] = useState(0.25);
  const [view, setView] = useState<View>("customers");
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [storeCurrency, setStoreCurrency] = useState("EUR");
  const stopRef = useRef(false);

  const summary = useMemo(() => summarizeReplay(items, rate, storeCurrency), [items, rate, storeCurrency]);
  const money = (n: number) => formatMoney(n, summary.currency);

  async function run() {
    stopRef.current = false;
    setError(null);
    setItems([]);
    setPhase("listing");
    try {
      const listed = await fetch("/api/replay/messages", { cache: "no-store" }).then((r) => r.json());
      if (!listed.success) {
        setError(listed.error?.message ?? "Could not read your mailbox.");
        setPhase("error");
        return;
      }
      const ids: string[] = listed.data.ids ?? [];
      if (listed.data.currency) setStoreCurrency(listed.data.currency);
      setTotal(ids.length);
      setPhase("analyzing");
      for (let i = 0; i < ids.length && !stopRef.current; i += REPLAY_MAX_IDS_PER_REQUEST) {
        const batch = ids.slice(i, i + REPLAY_MAX_IDS_PER_REQUEST);
        try {
          const res = await fetch("/api/replay/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: batch }),
          }).then((r) => r.json());
          const got: ReplayItem[] = res.success
            ? res.data.items
            : batch.map((id) => ({ id, from: "", subject: "", receivedAt: null, snippet: "", outcome: "error" as const, reason: res.error?.message }));
          setItems((prev) => [...prev, ...got]);
        } catch {
          setItems((prev) => [...prev, ...batch.map((id) => ({ id, from: "", subject: "", receivedAt: null, snippet: "", outcome: "error" as const }))]);
        }
      }
      setPhase("done");
    } catch {
      setError("Something went wrong while reading your mailbox.");
      setPhase("error");
    }
  }

  const counts = {
    customers: items.filter((i) => i.outcome === "auto_reply" || i.outcome === "draft" || i.outcome === "error").length,
    returns: items.filter((i) => i.returnCase).length,
    skipped: items.filter((i) => i.outcome === "filtered" || i.outcome === "not_customer").length,
    all: items.length,
  };

  const visible = items.filter((item) => {
    if (view === "all") return true;
    if (view === "returns") return Boolean(item.returnCase);
    if (view === "skipped") return item.outcome === "filtered" || item.outcome === "not_customer";
    return item.outcome === "auto_reply" || item.outcome === "draft" || item.outcome === "error";
  });

  const running = phase === "listing" || phase === "analyzing";
  const progress = total > 0 ? Math.round((items.length / total) * 100) : 0;
  const rateLabel = RATES.find((r) => Math.abs(r.value - rate) < 0.001)?.label ?? "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 pb-12">
      <PageHeader
        title="Inbox replay"
        description="What KeepMySale would have done with your last 50 inbox emails: the answers, the returns it could have saved, and what that is worth. Nothing is sent, saved or marked as read."
        actions={
          phase === "idle" ? null : (
            <>
              {running ? <Button variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button> : null}
              <Button onClick={run} loading={running}>
                {running ? "Reading" : <><ReplayIcon className="h-4 w-4" /> Run again</>}
              </Button>
            </>
          )
        }
      />

      {phase === "idle" ? (
        <section className="kms-card kms-enter overflow-hidden" style={{ ["--i" as string]: 1 }}>
          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">See KeepMySale on your own inbox</h2>
              <p className="mt-2 max-w-xl text-sm text-muted">
                One read of your recent mail, about a minute. You see every answer before anything is ever switched on.
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-3">
                <ReplayPromise icon={<ChatIcon className="h-[18px] w-[18px]" />} title="The answers">Which emails it answers itself, and the reply it would send.</ReplayPromise>
                <ReplayPromise icon={<CoinsIcon className="h-[18px] w-[18px]" />} title="The money">Return requests valued with your own first offer.</ReplayPromise>
                <ReplayPromise icon={<ShieldIcon className="h-[18px] w-[18px]" />} title="Read only">Nothing leaves your inbox. Strangers are never sent to the AI.</ReplayPromise>
              </ul>
            </div>
            <Button size="lg" onClick={run} className="md:self-center">
              <ReplayIcon className="h-5 w-5" /> Run replay
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "error" && error ? (
        <div role="alert" className="kms-enter flex items-start gap-3 rounded-[var(--radius-card)] bg-lost-soft p-4 text-sm text-lost ring-1 ring-inset ring-[#fbcdd6]">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {error}{" "}
            {error.toLowerCase().includes("gmail") ? <Link href="/dashboard/settings" className="font-semibold underline">Open Settings</Link> : null}
          </p>
        </div>
      ) : null}

      {running ? (
        <div className="kms-card kms-enter p-5" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <MailIcon className="h-4 w-4 text-kept" />
              {phase === "listing" ? "Reading your inbox" : `Analysed ${items.length} of ${total} emails`}
            </span>
            {phase === "analyzing" ? <span className="text-muted tabular">{progress}%</span> : null}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full bg-kept transition-[width] duration-500 ease-out ${phase === "listing" ? "w-1/5 animate-pulse" : ""}`}
              style={phase === "analyzing" ? { width: `${Math.max(progress, 3)}%` } : undefined}
            />
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <div className="kms-enter relative overflow-hidden rounded-[18px] bg-ink p-6 text-white shadow-raised">
              <p className="text-sm font-medium text-slate-300">Revenue you could have kept</p>
              <p className="mt-3 text-[2.5rem] font-bold leading-none tracking-[-0.035em] tabular">
                <span className="kms-kept-number" data-landed={phase === "done" && summary.expectedKept > 0 ? "true" : "false"}>{money(summary.expectedKept)}</span>
              </p>
              <p className="mt-3 text-[13px] text-slate-400">
                If {rateLabel} customers take your first offer. Up to {money(summary.keptIfAllAccept)} of {money(summary.valueAtStake)} at stake.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Assumed acceptance">
                {RATES.map((r) => {
                  const on = Math.abs(rate - r.value) < 0.001;
                  return (
                    <button
                      key={r.label}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setRate(r.value)}
                      className={`kms-press rounded-full px-3 py-1 text-[13px] font-medium ${on ? "bg-kept-glow text-ink" : "bg-white/[0.08] text-slate-300 hover:bg-white/[0.14]"}`}
                    >
                      {r.label}
                    </button>
                  );
                })}
                <span className="text-xs text-slate-400">accept: an assumption, not a forecast</span>
              </div>
            </div>

            <dl className="kms-card kms-enter grid grid-cols-2 gap-x-6 gap-y-5 p-6" style={{ ["--i" as string]: 1 }}>
              <Fact label="Customer emails" value={summary.autoReplies + summary.drafts} note={`of ${summary.total} read`} />
              <Fact label="Answered itself" value={summary.autoReplies} note={`${summary.drafts} as a draft for you`} tone="kept" />
              <Fact label="Return requests" value={summary.returnRequests} note={`${summary.eligibleReturns} eligible for an offer`} />
              <Fact label="Skipped" value={summary.filtered + summary.notCustomer} note="Not support, or never ordered" />
            </dl>
          </section>

          <section className="kms-card overflow-hidden">
            <div className="px-3 pt-2">
              <Tabs
                tabs={[
                  { key: "customers", label: "Customers", count: counts.customers },
                  { key: "returns", label: "Returns", count: counts.returns },
                  { key: "skipped", label: "Skipped", count: counts.skipped },
                  { key: "all", label: "All", count: counts.all },
                ]}
                active={view}
                onChange={setView}
              />
            </div>

            <ul className="divide-y divide-line">
              {visible.map((item, index) => (
                <li key={item.id} className="kms-enter px-5 py-4" style={{ ["--i" as string]: Math.min(index % REPLAY_MAX_IDS_PER_REQUEST, 3) }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{item.subject || "(no subject)"}</p>
                      <p className="truncate text-xs text-muted">
                        {item.from}
                        {item.receivedAt ? ` · ${new Date(item.receivedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
                      </p>
                    </div>
                    <Badge variant={OUTCOME[item.outcome].variant} dot className="shrink-0 self-start">{OUTCOME[item.outcome].label}</Badge>
                  </div>

                  {item.snippet ? <p className="mt-2 line-clamp-2 text-sm text-muted">{item.snippet}</p> : null}

                  {item.returnCase ? (
                    <div className="mt-3 rounded-[10px] bg-kept-soft px-3 py-2.5 text-[13px] text-[#134e4a]">
                      {item.returnCase.eligible && item.returnCase.orderValue !== null ? (
                        <>
                          Return of {item.returnCase.orderLabel} ({formatMoney(item.returnCase.orderValue, item.returnCase.currency ?? summary.currency)}).
                          First offer {item.returnCase.firstOfferPercentage}% {item.returnCase.firstOfferType === "store_credit" ? "store credit" : "refund"}: you keep the sale and{" "}
                          <strong className="font-semibold">{formatMoney(item.returnCase.keptIfAccepted ?? 0, item.returnCase.currency ?? summary.currency)}</strong> if accepted.
                        </>
                      ) : (
                        <>Return request, no offer: {returnReason(item.returnCase.reason)}.</>
                      )}
                    </div>
                  ) : null}

                  {item.reply ? (
                    <div className="mt-3">
                      <button
                        onClick={() => setOpenReply(openReply === item.id ? null : item.id)}
                        aria-expanded={openReply === item.id}
                        className="text-[13px] font-semibold text-kept-strong hover:underline"
                      >
                        {openReply === item.id ? "Hide the answer" : "Show the answer KeepMySale would send"}
                      </button>
                      {openReply === item.id ? (
                        <p className="kms-enter mt-2 whitespace-pre-wrap rounded-[10px] bg-surface-2 p-3.5 text-sm leading-relaxed text-foreground ring-1 ring-inset ring-line">{item.reply}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {item.outcome !== "auto_reply" && item.outcome !== "draft" && item.reason ? (
                    <p className="mt-2 text-xs text-faint">{item.reason}</p>
                  ) : null}
                </li>
              ))}
              {visible.length === 0 ? <li className="px-5 py-10 text-center text-sm text-muted">Nothing in this view yet.</li> : null}
            </ul>
          </section>
        </>
      ) : phase === "done" ? (
        <p className="text-sm text-muted">No inbox email from the last 90 days to replay.</p>
      ) : null}
    </div>
  );
}

function returnReason(reason?: string) {
  if (reason === "no_matching_order") return "no order found for this customer";
  if (reason === "negotiation_off") return "return negotiation is switched off in Settings";
  return reason ?? "not eligible under your settings";
}

function ReplayPromise({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-kept-soft text-kept-strong">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{children}</span>
      </span>
    </li>
  );
}

function Fact({ label, value, note, tone }: { label: string; value: number; note: string; tone?: "kept" }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={`mt-1 text-[1.5rem] font-semibold tracking-[-0.02em] tabular ${tone === "kept" ? "text-kept-strong" : "text-foreground"}`}>{value}</dd>
      <dd className="text-xs text-faint">{note}</dd>
    </div>
  );
}
