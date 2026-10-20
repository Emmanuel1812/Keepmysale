import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OnboardingFrame } from "@/components/onboarding/step-indicator";
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
    redirect(`/api/shopify/install?shop=${encodeURIComponent(String(sp.shop))}`);
  }

  // Determine current step
  const currentStep = sp.step || "shopify"; // Start at shopify by default
  let activeIndex = 0;
  if (currentStep === "rules") activeIndex = 1;
  if (currentStep === "email") activeIndex = 2;

  return (
    <OnboardingFrame activeIndex={activeIndex}>
      <Suspense fallback={<div className="kms-card h-64" />}>
        {currentStep === "shopify" && <ShopifyConnectCard />}
        {currentStep === "rules" && <ReturnRulesForm />}
        {currentStep === "email" && <EmailConnectStep />}
      </Suspense>
    </OnboardingFrame>
  );
}
