import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "teal" | "amber" | "rose";
  /** A small leading dot in the badge colour, for statuses. */
  dot?: boolean;
}

const variants = {
  default: "bg-surface-2 text-muted ring-line",
  outline: "bg-transparent text-muted ring-line-strong",
  teal: "bg-kept-soft text-kept-strong ring-[#bfe7e2]",
  amber: "bg-attention-soft text-attention ring-[#f7dfb4]",
  rose: "bg-lost-soft text-lost ring-[#fbcdd6]",
};

export function Badge({ className = "", variant = "default", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${variants[variant]} ${className}`}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
