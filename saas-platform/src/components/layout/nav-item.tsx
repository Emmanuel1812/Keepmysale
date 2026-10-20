"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, HomeIcon, InboxIcon, ReplayIcon, ReturnIcon, SettingsIcon } from "@/components/ui/icons";

export const NAV_ICONS = {
  overview: HomeIcon,
  inbox: InboxIcon,
  orders: BoxIcon,
  returns: ReturnIcon,
  replay: ReplayIcon,
  settings: SettingsIcon,
} as const;

export type NavIconKey = keyof typeof NAV_ICONS;

interface NavItemProps {
  href: string;
  label: string;
  icon: NavIconKey;
  badge?: number;
  onNavigate?: () => void;
}

export function isActivePath(pathname: string | null, href: string) {
  return pathname === href || (href !== "/dashboard" && Boolean(pathname?.startsWith(href)));
}

export function NavItem({ href, label, icon, badge, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, href);
  const Icon = NAV_ICONS[icon];

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-center justify-between rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        isActive ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
      }`}
    >
      {/* the active marker: a short teal bar that grows in */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-kept-glow transition-transform duration-200 ease-out ${
          isActive ? "scale-y-100" : "scale-y-0"
        }`}
      />
      <span className="flex items-center gap-3">
        <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-kept-glow" : "text-slate-500 group-hover:text-slate-300"}`} />
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="kms-ping min-w-5 rounded-full bg-kept px-1.5 py-0.5 text-center text-[11px] font-bold text-white tabular">{badge}</span>
      )}
    </Link>
  );
}
