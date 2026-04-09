import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "default" | "sm" | "lg";
}

const variantClassMap: Record<ButtonVariant, string> = {
  default: "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
  outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "bg-transparent text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
};

export function Button({ className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  const sizeClasses = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1 text-xs",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition ${variantClassMap[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
