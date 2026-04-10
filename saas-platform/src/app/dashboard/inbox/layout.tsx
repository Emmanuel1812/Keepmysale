"use client";

import { usePathname } from "next/navigation";
import { InboxSidebar } from "@/components/inbox/inbox-sidebar";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isThreadView = pathname !== "/dashboard/inbox";

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className={`${isThreadView ? "hidden md:flex" : "flex"} w-full md:w-[380px] shrink-0 flex-col border-r border-zinc-200 bg-[#f8fafb] overflow-hidden`}>
        <InboxSidebar />
      </div>
      <div className={`${!isThreadView ? "hidden md:flex" : "flex"} flex-1 flex-col bg-white overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}
