interface StepIndicatorProps {
  steps: string[];
  activeIndex: number;
}

export function StepIndicator({ steps, activeIndex }: StepIndicatorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;

        return (
          <div
            key={step}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#111827] text-white shadow-md border border-transparent"
                : isPast
                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                  : "bg-white text-zinc-500 border border-zinc-200"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
              isActive 
                ? "bg-white/20 text-white" 
                : isPast 
                  ? "bg-teal-200/50 text-teal-800" 
                  : "bg-zinc-100 text-zinc-500"
            }`}>
              {index + 1}
            </span>
            {step}
          </div>
        );
      })}
    </div>
  );
}
