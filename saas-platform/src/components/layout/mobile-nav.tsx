"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import logo from "@/app/logo.png";
import { NavItem, isActivePath } from "@/components/layout/nav-item";
import { NAV_LINKS } from "@/components/layout/nav-links";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/**
 * Below the md breakpoint the sidebar is hidden; before this there was no navigation at all on a phone.
 * A top bar names the current section and opens the same links in a drawer.
 */
export function MobileNav({ shopName, inboxBadge }: { shopName: string; inboxBadge?: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV_LINKS.find((link) => isActivePath(pathname, link.href));

  // Close on route change and on Escape
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-white">
        <div className="flex items-center gap-2.5">
          <Image src={logo} alt="" width={26} height={26} className="rounded-[7px] bg-white p-0.5" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{current?.label ?? "KeepMySale"}</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="kms-press relative grid h-10 w-10 place-items-center rounded-[10px] text-slate-300 hover:bg-white/[0.06]"
        >
          <MenuIcon className="h-5 w-5" />
          {inboxBadge ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-kept-glow" aria-hidden="true" /> : null}
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] [animation:kms-fade-in_200ms_ease_both]"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink px-3 py-4 text-white shadow-raised [animation:kms-drawer-in_260ms_var(--ease-out)_both] motion-reduce:[animation:kms-fade-in_150ms_ease_both]">
            <div className="mb-6 flex items-center justify-between px-2">
              <span className="text-[17px] font-bold tracking-[-0.02em]">KeepMySale</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-400 hover:bg-white/[0.06]">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main" className="flex flex-col gap-0.5">
              {NAV_LINKS.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  badge={link.href === "/dashboard/inbox" ? inboxBadge : undefined}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </nav>
            {shopName ? <p className="mt-auto truncate px-3 text-sm text-slate-400">{shopName}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
