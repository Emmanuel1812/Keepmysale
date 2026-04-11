import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ShopifyConnectCard } from "@/components/onboarding/shopify-connect";
import { ReturnRulesForm } from "@/components/onboarding/return-rules-form";
import { EmailConnectStep } from "@/components/onboarding/email-connect";

export default async function OnboardingPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ shop?: string; step?: string; google_success?: string }> 
}) {
  const sp = await searchParams;
  
  // Handle Shopify install redirect
  if (sp.shop) {
    redirect(`/api/shopify/install?shop=${sp.shop}`);
  }

  // Determine current step
  const currentStep = sp.step || "rules"; // Default to rules if skip or after install
  const steps = ["Connect Shopify", "Configure Rules", "Connect Email"];
  
  let activeIndex = 1;
  if (currentStep === "shopify") activeIndex = 0;
  if (currentStep === "rules") activeIndex = 1;
  if (currentStep === "email") activeIndex = 2;

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#f8fafb] pt-20">
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-6">
        <div className="flex flex-col items-center text-center gap-1.5 mb-2">
          <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">KeepMySale Onboarding</h1>
          <p className="text-sm font-medium text-zinc-500">Configureer je AI helpdesk in enkele stappen.</p>
        </div>
        
        <Suspense fallback={<div className="p-12 text-center text-zinc-500 font-medium">Loading onboarding...</div>}>
          <div className="flex justify-center mb-2">
            <StepIndicator steps={steps} activeIndex={activeIndex} />
          </div>

          <div className="w-full">
            {currentStep === "shopify" && <ShopifyConnectCard />}
            {currentStep === "rules" && <ReturnRulesForm />}
            {currentStep === "email" && <EmailConnectStep />}
          </div>
        </Suspense>

      </main>
    </div>
  );
}
