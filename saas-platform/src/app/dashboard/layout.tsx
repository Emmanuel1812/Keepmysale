import { Suspense, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#f8fafb]">Loading...</div>}>
      <DashboardShell 
        sidebar={<Sidebar />} 
        header={<Header />}
      >
        {children}
      </DashboardShell>
    </Suspense>
  );
}
