import { OnboardingFrame } from "@/components/onboarding/step-indicator";
import { ReturnRulesForm } from "@/components/onboarding/return-rules-form";

// New installs land here from the Shopify callback: step 2 of the same setup flow
export default function OnboardingConfigurePage() {
  return (
    <OnboardingFrame activeIndex={1}>
      <ReturnRulesForm />
    </OnboardingFrame>
  );
}
