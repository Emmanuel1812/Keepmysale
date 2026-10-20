import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-[10px] border border-line-strong bg-white px-3 text-sm text-foreground placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-faint focus:border-kept focus:shadow-[0_0_0_3px_rgb(13_148_136/0.15)] focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint ${className}`}
      {...props}
    />
  );
}
