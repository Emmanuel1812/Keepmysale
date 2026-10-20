import { OnboardingFrame } from "@/components/onboarding/step-indicator";
import { ShopifyConnectCard } from "@/components/onboarding/shopify-connect";

export default function OnboardingConnectShopifyPage() {
  return (
    <OnboardingFrame activeIndex={0}>
      <ShopifyConnectCard />
    </OnboardingFrame>
  );
}
