"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/onboarding/step-indicator";
import { ArrowRightIcon, CheckIcon, MailIcon } from "@/components/ui/icons";

export function EmailConnectStep() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSuccess = searchParams.get("google_success") === "true";

  // Google's consent screen refuses to open inside the Shopify admin frame, so leave the frame
  const handleGoogleConnect = () => window.open("/api/auth/google", "_top");
  const handleComplete = () => router.replace("/dashboard");

  return (
    <StepCard title="Connect your support email" description="KeepMySale reads customer emails in your Gmail and answers from your own address.">
      {isSuccess ? (
        <>
          <div className="kms-enter flex items-start gap-3 rounded-[12px] bg-kept-soft p-4 text-sm text-[#134e4a] ring-1 ring-inset ring-[#bfe7e2]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-kept text-white"><CheckIcon className="h-4 w-4" /></span>
            <div>
              <p className="font-semibold">Gmail is connected</p>
              <p className="mt-0.5">Replies go out from your own address.</p>
            </div>
          </div>
          <div className="flex justify-end border-t border-line pt-5">
            <Button onClick={handleComplete}>Go to your dashboard <ArrowRightIcon className="h-4 w-4" /></Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoogleConnect}
            className="kms-press group flex w-full items-center gap-3 rounded-[12px] bg-white px-4 py-3.5 text-left text-sm font-semibold text-foreground shadow-card ring-1 ring-inset ring-line hover:ring-kept"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#EA4335]/10 text-[13px] font-bold text-[#c5221f]">G</span>
            Connect Gmail
            <span className="ml-auto rounded-full bg-kept-soft px-2 py-0.5 text-xs font-medium text-kept-strong">Recommended</span>
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true"><span className="w-full border-t border-line" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 font-medium text-faint">or</span></div>
          </div>

          <button
            onClick={handleComplete}
            className="kms-press flex w-full items-center gap-3 rounded-[12px] bg-surface-2 px-4 py-3.5 text-left text-sm font-medium text-muted ring-1 ring-inset ring-line hover:bg-[#eef2f4] hover:text-foreground"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-white text-muted"><MailIcon className="h-4 w-4" /></span>
            Skip for now
            <span className="ml-auto text-xs font-normal text-faint">Use email forwarding instead</span>
          </button>
        </div>
      )}
    </StepCard>
  );
}
