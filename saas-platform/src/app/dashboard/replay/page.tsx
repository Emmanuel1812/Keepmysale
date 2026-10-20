"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { REPLAY_MAX_IDS_PER_REQUEST, summarizeReplay, type ReplayItem, type ReplayOutcome } from "@/lib/replay/summary";

type Phase = "idle" | "listing" | "analyzing" | "done" | "error";
type View = "customers" | "returns" | "skipped" | "all";

const OUTCOME_LABEL: Record<ReplayOutcome, string> = {
  auto_reply: "Would answer",
  draft: "Draft for you",
  filtered: "Skipped: not support mail",
  not_customer: "Skipped: never ordered",
  error: "Could not analyse",
};

const OUTCOME_STYLE: Record<ReplayOutcome, string> = {
  auto_reply: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  filtered: "bg-zinc-50 text-zinc-500 border-zinc-200",
  not_customer: "bg-zinc-50 text-zinc-500 border-zinc-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
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
  const stopRef = useRef(false);

  const summary = useMemo(() => summarizeReplay(items, rate), [items, rate]);
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

  const visible = items.filter((item) => {
    if (view === "all") return true;
    if (view === "returns") return Boolean(item.returnCase);
    if (view === "skipped") return item.outcome === "filtered" || item.outcome === "not_customer";
    return item.outcome === "auto_reply" || item.outcome === "draft" || item.outcome === "error";
  });

  const running = phase === "listing" || phase === "analyzing";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-4 sm:p-6 pb-24 font-sans">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Inbox replay</h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Keepmysale reads your last 50 inbox emails and shows what it would have answered, which returns it could have
            saved, and what that is worth. Nothing is sent, saved or marked as read.
          </p>
        </div>
        <div className="flex gap-2">
          {running ? (
            <button
              onClick={() => { stopRef.current = true; }}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Stop
            </button>
          ) : null}
          <button
            onClick={run}
            disabled={running}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {phase === "idle" ? "Run replay" : running ? "Running…" : "Run again"}
          </button>
        </div>
      </div>

      {phase === "error" && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}{" "}
          {error.toLowerCase().includes("gmail") ? <Link href="/dashboard/settings" className="underline">Open Settings</Link> : null}
        </div>
      ) : null}

      {running ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          {phase === "listing" ? "Reading your inbox…" : `Analysed ${items.length} of ${total} emails…`}
          {phase === "analyzing" && total > 0 ? (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${Math.round((items.length / total) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Customer emails" value={String(summary.autoReplies + summary.drafts)} note={`of ${summary.total} read; ${summary.filtered + summary.notCustomer} skipped`} />
            <Stat label="Would answer itself" value={String(summary.autoReplies)} note={`${summary.drafts} as a draft for you to check`} />
            <Stat label="Return requests" value={String(summary.returnRequests)} note={`${summary.eligibleReturns} eligible for an offer`} />
            <Stat
              tone="emerald"
              label="Revenue you could keep"
              value={money(summary.expectedKept)}
              note={`if ${RATES.find((r) => Math.abs(r.value - rate) < 0.001)?.label ?? ""} take your first offer (max ${money(summary.keptIfAllAccept)} of ${money(summary.valueAtStake)} at stake)`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">Assume</span>
            {RATES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRate(r.value)}
                className={`rounded-full border px-3 py-1 ${Math.abs(rate - r.value) < 0.001 ? "border-teal-600 bg-teal-50 text-teal-800" : "border-zinc-200 text-zinc-600"}`}
              >
                {r.label}
              </button>
            ))}
            <span className="text-zinc-500">customers accept your first offer. This is an assumption, not a forecast.</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              ["customers", "Customers"],
              ["returns", "Returns"],
              ["skipped", "Skipped"],
              ["all", "All"],
            ] as Array<[View, string]>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === key ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="flex flex-col gap-3">
            {visible.map((item) => (
              <li key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900">{item.subject || "(no subject)"}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {item.from}
                      {item.receivedAt ? ` · ${new Date(item.receivedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 self-start rounded-full border px-2.5 py-0.5 text-xs font-medium ${OUTCOME_STYLE[item.outcome]}`}>
                    {OUTCOME_LABEL[item.outcome]}
                  </span>
                </div>

                {item.snippet ? <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{item.snippet}</p> : null}

                {item.returnCase ? (
                  <div className="mt-3 rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                    {item.returnCase.eligible && item.returnCase.orderValue !== null ? (
                      <>
                        Return of {item.returnCase.orderLabel} ({formatMoney(item.returnCase.orderValue, item.returnCase.currency ?? summary.currency)}).
                        First offer: {item.returnCase.firstOfferPercentage}% {item.returnCase.firstOfferType === "store_credit" ? "store credit" : "refund"}, keep the sale and{" "}
                        <strong>{formatMoney(item.returnCase.keptIfAccepted ?? 0, item.returnCase.currency ?? summary.currency)}</strong> if accepted.
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
                      className="text-sm font-medium text-teal-700 hover:underline"
                    >
                      {openReply === item.id ? "Hide the answer" : "Show the answer Keepmysale would send"}
                    </button>
                    {openReply === item.id ? (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">{item.reply}</p>
                    ) : null}
                  </div>
                ) : null}

                {item.outcome !== "auto_reply" && item.outcome !== "draft" && item.reason ? (
                  <p className="mt-2 text-xs text-zinc-400">{item.reason}</p>
                ) : null}
              </li>
            ))}
            {visible.length === 0 ? <li className="text-sm text-zinc-500">Nothing in this view.</li> : null}
          </ul>
        </>
      ) : phase === "done" ? (
        <p className="text-sm text-zinc-500">No inbox email from the last 90 days to replay.</p>
      ) : null}
    </div>
  );
}

function returnReason(reason?: string) {
  if (reason === "no_matching_order") return "no order found for this customer";
  if (reason === "negotiation_off") return "return negotiation is switched off in Settings";
  return reason ?? "not eligible under your settings";
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "emerald" }) {
  const box = tone === "emerald" ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-white";
  const num = tone === "emerald" ? "text-emerald-700" : "text-zinc-900";
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${box}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</h3>
      <p className={`mt-2 text-2xl font-bold ${num}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  );
}
