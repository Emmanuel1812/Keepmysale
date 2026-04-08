import { redirect } from "next/navigation";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ShopifyConnectCard } from "@/components/onboarding/shopify-connect";
import { ReturnRulesForm } from "@/components/onboarding/return-rules-form";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const sp = await searchParams;
  if (sp.shop) {
    redirect(`/api/shopify/install?shop=${sp.shop}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Merchant Onboarding</h1>
      <StepIndicator steps={["Welcome", "Connect Shopify", "Configure"]} activeIndex={0} />
      <ShopifyConnectCard />
      <ReturnRulesForm />
    </main>
  );
}
