import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ReturnRulesForm } from "@/components/onboarding/return-rules-form";
import { Card } from "@/components/ui/card";

export default function OnboardingConfigurePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Configure Automation</h1>
      <StepIndicator steps={["Welcome", "Connect Shopify", "Configure"]} activeIndex={2} />
      <Card className="text-sm text-zinc-600 dark:text-zinc-300">
        Saving this form creates your merchant profile. On success you are redirected to `/dashboard`.
      </Card>
      <ReturnRulesForm />
    </main>
  );
}
