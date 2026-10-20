import type { HTMLAttributes } from "react";

// Elevation is declared once: a soft offset shadow, no border (see globals.css .kms-card).
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`kms-card p-5 ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-4 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`kms-section-title ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-1 text-sm text-muted ${className}`} {...props} />;
}
