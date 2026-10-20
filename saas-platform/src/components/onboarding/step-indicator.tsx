import type { ReactNode } from "react";
import Image from "next/image";
import logo from "@/app/logo.png";

export const ONBOARDING_STEPS = ["Connect Shopify", "Your store", "Connect email"] as const;

interface StepIndicatorProps {
  steps: readonly string[];
  activeIndex: number;
}

/** Numbered steps joined by a rule that fills teal as the merchant moves through them. */
export function StepIndicator({ steps, activeIndex }: StepIndicatorProps) {
  return (
    <ol className="flex w-full items-center" aria-label="Setup progress">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;
        return (
          <li key={step} className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`} aria-current={isActive ? "step" : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${
                  isActive ? "bg-ink text-white" : isPast ? "bg-kept text-white" : "bg-white text-faint ring-1 ring-inset ring-line-strong"
                }`}
              >
                {isPast ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className={`hidden whitespace-nowrap text-[13px] font-medium sm:inline ${isActive ? "text-foreground" : "text-muted"}`}>{step}</span>
            </span>
            {index < steps.length - 1 ? (
              <span className="mx-3 h-[2px] flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className={`block h-full origin-left bg-kept transition-transform duration-500 [transition-timing-function:var(--ease-out)] ${isPast ? "scale-x-100" : "scale-x-0"}`} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The shared frame of every onboarding screen. */
export function OnboardingFrame({ activeIndex, children }: { activeIndex: number; children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-5 pb-16 pt-12 sm:pt-20">
      <main className="flex w-full max-w-[600px] flex-col gap-8">
        <div className="kms-enter flex flex-col items-center gap-3 text-center">
          <Image src={logo} alt="" width={40} height={40} className="rounded-[11px] bg-white p-1 shadow-card" />
          <div>
            <h1 className="kms-heading">Set up KeepMySale</h1>
            <p className="mt-1.5 text-sm text-muted">Three steps, about five minutes. Nothing is sent to customers until you switch it on.</p>
          </div>
        </div>
        <div className="kms-enter" style={{ ["--i" as string]: 1 }}>
          <StepIndicator steps={ONBOARDING_STEPS} activeIndex={activeIndex} />
        </div>
        <div className="kms-enter" style={{ ["--i" as string]: 2 }}>{children}</div>
      </main>
    </div>
  );
}

/** One onboarding step's card: title, why, then the form. */
export function StepCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="kms-card overflow-hidden">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="grid gap-5 p-6">{children}</div>
    </section>
  );
}
