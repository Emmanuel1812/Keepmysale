import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ShopifyConnectCard } from "@/components/onboarding/shopify-connect";
import { ReturnRulesForm } from "@/components/onboarding/return-rules-form";
import { EmailConnectStep } from "@/components/onboarding/email-connect";
import { getMerchantFromSession } from "@/lib/auth";

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

  // Validation: Some steps might require an active session
  // But for now we rely on the components themselves or the redirect flow.

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">KeepMySale Onboarding</h1>
        <p className="text-sm text-zinc-500">Configureer je AI helpdesk in enkele stappen.</p>
      </div>
      
      <StepIndicator steps={steps} activeIndex={activeIndex} />

      <div className="mt-4">
        {currentStep === "shopify" && <ShopifyConnectCard />}
        {currentStep === "rules" && <ReturnRulesForm />}
        {currentStep === "email" && <EmailConnectStep />}
      </div>
    </main>
  );
}
