import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ShopifyConnectCard } from "@/components/onboarding/shopify-connect";

export default function OnboardingConnectShopifyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Connect Shopify</h1>
      <StepIndicator steps={["Welcome", "Connect Shopify", "Configure"]} activeIndex={1} />
      <ShopifyConnectCard />
    </main>
  );
}
