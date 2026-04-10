"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  href: string;
  label: string;
  badge?: number;
}

export function NavItem({ href, label, badge }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));

  return (
    <Link 
      href={href} 
      className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive 
          ? "bg-teal-500/10 text-teal-400" 
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-3">
        {isActive ? (
          <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
        )}
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-xs font-semibold text-teal-400">
          {badge}
        </span>
      )}
    </Link>
  );
}
