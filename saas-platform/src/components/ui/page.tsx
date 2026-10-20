import type { ReactNode } from "react";

/** Page title row: heading + one line of purpose on the left, the page's actions on the right. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="kms-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="kms-heading">{title}</h1>
        {description ? <p className="kms-subheading">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** An empty state that tells the merchant what will appear here and how to get it. */
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-kept-soft text-kept-strong">{icon}</div> : null}
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** A placeholder bar for loading content. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`kms-skeleton inline-block ${className}`} aria-hidden="true" />;
}

/** Underline tabs; the active one is teal. Pass `count` to show a number next to the label. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: T; label: string; count?: number }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`relative -mb-px flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular ${isActive ? "bg-kept-soft text-kept-strong" : "bg-surface-2 text-faint"}`}>
                {tab.count}
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2 bottom-0 h-[2px] origin-center rounded-full bg-kept transition-transform duration-200 ease-out ${isActive ? "scale-x-100" : "scale-x-0"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
