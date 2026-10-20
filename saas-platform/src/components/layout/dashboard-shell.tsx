"use client";

import { useIsEmbedded } from "@/hooks/use-is-embedded";
import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/shopify/app-nav";

interface DashboardShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  header: ReactNode;
}

function DashboardShellInner({ children, sidebar, header }: DashboardShellProps) {
  const isEmbedded = useIsEmbedded();

  if (isEmbedded) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <AppNav />
        <main className="flex-1 overflow-auto px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
    );
  }

  return (
    // The sidebar renders the desktop rail and, below md, the mobile top bar + drawer
    <div className="flex min-h-screen flex-col md:flex-row">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 overflow-auto px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-background" />}>
      <DashboardShellInner {...props} />
    </Suspense>
  );
}

