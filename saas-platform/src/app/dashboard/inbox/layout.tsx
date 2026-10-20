"use client";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { InboxSidebar } from "@/components/inbox/inbox-sidebar";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isThreadView = pathname !== "/dashboard/inbox";

  return (
    <Suspense fallback={<div className="kms-card h-[calc(100dvh-8rem)] w-full md:h-[calc(100vh-3.5rem)]" />}>
      <div className="kms-card kms-enter flex h-[calc(100dvh-8rem)] w-full overflow-hidden md:h-[calc(100vh-3.5rem)]">
        <div className={`${isThreadView ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col overflow-hidden border-r border-line bg-surface-2 md:w-[360px]`}>
          <InboxSidebar />
        </div>
        <div className={`${!isThreadView ? "hidden md:flex" : "flex"} flex-1 flex-col bg-white overflow-hidden`}>
          {children}
        </div>
      </div>
    </Suspense>
  );

}
