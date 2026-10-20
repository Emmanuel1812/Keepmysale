import type { NavIconKey } from "@/components/layout/nav-item";

/** The dashboard's sections, in order. The sidebar, the mobile menu and the Shopify admin nav all read this. */
export const NAV_LINKS: ReadonlyArray<{ href: string; label: string; icon: NavIconKey }> = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "inbox" },
  { href: "/dashboard/orders", label: "Orders", icon: "orders" },
  { href: "/dashboard/returns", label: "Returns", icon: "returns" },
  { href: "/dashboard/replay", label: "Inbox replay", icon: "replay" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];
