import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "danger" | "destructive" | "ink";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "default" | "sm" | "lg";
  /** Shows a spinner and blocks repeat clicks while an action runs. */
  loading?: boolean;
}

// Teal is the product's "go / keep" colour, so the primary action wears it; ink is for actions on dark bands.
const variantClassMap: Record<ButtonVariant, string> = {
  default: "bg-kept text-white shadow-[0_1px_2px_rgb(15_23_42/0.12)] hover:bg-kept-strong",
  ink: "bg-ink text-white hover:bg-ink-2",
  outline: "border border-line-strong bg-white text-foreground hover:border-faint hover:bg-surface-2",
  ghost: "bg-transparent text-foreground hover:bg-surface-2",
  secondary: "bg-surface-2 text-foreground ring-1 ring-inset ring-line hover:bg-[#eef2f4]",
  danger: "bg-lost text-white hover:bg-[#9f1239]",
  destructive: "bg-lost text-white hover:bg-[#9f1239]",
};

const sizeClasses = {
  default: "h-9 px-4 text-sm gap-2",
  sm: "h-8 px-3 text-[13px] gap-1.5",
  lg: "h-11 px-6 text-base gap-2",
};

export function Button({ className = "", variant = "default", size = "default", loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={`kms-press inline-flex select-none items-center justify-center whitespace-nowrap rounded-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-55 ${variantClassMap[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
