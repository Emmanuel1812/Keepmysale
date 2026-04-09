"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailConnectStep() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSuccess = searchParams.get("google_success") === "true";
  
  // We should ideally fetch the connected email if isSuccess is true, 
  // but for the onboarding flow we can simplify or use the merchant session.
  // The user prompt says to show a success message.

  const handleGoogleConnect = () => {
    window.location.href = "/api/auth/google";
  };

  const handleComplete = () => {
    router.replace("/dashboard");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Koppel je support email</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isSuccess ? (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <p className="font-medium">✅ Email succesvol gekoppeld!</p>
            <p className="mt-1">Je AI helpdesk gebruikt nu je eigen Gmail adres voor antwoorden.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleGoogleConnect}
              className="flex w-full items-center justify-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                G
              </div>
              Inloggen met Google
              <span className="ml-auto text-xs font-normal text-zinc-500">Aanbevolen — 1 klik</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-950">Of</span>
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              📧 Overslaan (SES fallback)
              <span className="ml-auto text-xs font-normal text-zinc-500">Ik gebruik geen Gmail</span>
            </button>
          </div>
        )}

        {isSuccess && (
          <Button onClick={handleComplete} className="mt-2 w-full">
            Verder naar Dashboard
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
