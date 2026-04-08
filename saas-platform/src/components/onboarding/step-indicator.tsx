interface StepIndicatorProps {
  steps: string[];
  activeIndex: number;
}

export function StepIndicator({ steps, activeIndex }: StepIndicatorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`rounded-full px-3 py-1 text-xs ${
            index === activeIndex
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          }`}
        >
          {index + 1}. {step}
        </div>
      ))}
    </div>
  );
}
