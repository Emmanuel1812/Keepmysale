import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_CONTACT_EMAIL = "eo.commerces@gmail.com";
export const LEGAL_OPERATOR = "EFO Commerces";
export const LEGAL_KVK = "89053338";
export const LEGAL_UPDATED = "19 October 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafb] text-[#111827]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">KeepMySale</Link>
          <nav className="flex gap-5 text-sm text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-900">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-900">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-7 text-zinc-700 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#111827] [&_li]:ml-5 [&_li]:list-disc [&_a]:text-teal-700 [&_a]:underline">
          {children}
        </div>
        <p className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-500">
          KeepMySale is operated by {LEGAL_OPERATOR}, the Netherlands &middot; KvK {LEGAL_KVK} &middot;{" "}
          <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
      </main>
    </div>
  );
}
