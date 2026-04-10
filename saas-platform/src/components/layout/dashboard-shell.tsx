"use client";

import { useIsEmbedded } from "@/hooks/use-is-embedded";
import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  header: ReactNode;
}

export function DashboardShell({ children, sidebar, header }: DashboardShellProps) {
  const isEmbedded = useIsEmbedded();

  if (isEmbedded) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-[#f8fafb]">
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex">{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
