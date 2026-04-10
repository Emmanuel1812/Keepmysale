"use client";

import { useSearchParams, useRouter } from "next/navigation";

export function EmailConnectStep() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSuccess = searchParams.get("google_success") === "true";

  const handleGoogleConnect = () => {
    window.location.href = "/api/auth/google";
  };

  const handleComplete = () => {
    router.replace("/dashboard");
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-zinc-200 bg-white px-6 py-5">
        <h3 className="text-lg font-bold text-[#111827]">Koppel je support email</h3>
        <p className="mt-1 text-sm text-zinc-500">Connect your Gmail account to let your AI helpdesk respond directly.</p>
      </div>
      <div className="p-6 grid gap-5 bg-white">
        {isSuccess ? (
          <div className="rounded-lg bg-teal-50 border border-teal-100 p-4 text-sm text-teal-800">
            <p className="font-bold flex items-center gap-2">✅ Email succesvol gekoppeld!</p>
            <p className="mt-1 font-medium">Je AI helpdesk gebruikt nu je eigen Gmail adres voor antwoorden.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleGoogleConnect}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-zinc-50"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
                G
              </div>
              Inloggen met Google
              <span className="ml-auto text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Aanbevolen</span>
            </button>

            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 font-semibold text-zinc-400">Of</span>
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-[#f8fafb] px-4 py-3 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100"
            >
              📧 Overslaan (SES fallback)
              <span className="ml-auto text-xs font-normal text-zinc-400">Ik gebruik geen Gmail</span>
            </button>
          </div>
        )}

        {isSuccess && (
          <div className="mt-2 flex items-center justify-end border-t border-zinc-100 pt-5">
            <button 
              onClick={handleComplete} 
              className="flex items-center justify-center rounded-lg bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black"
            >
              Verder naar Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
