"use client";

import { createElement } from "react";

export const EMBEDDED_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/returns", label: "Returns" },
  { href: "/dashboard/settings", label: "Settings" },
];

/**
 * Inside Shopify admin the app's own sidebar is hidden, which left Inbox, Orders, Returns and Settings
 * unreachable. <s-app-nav> (App Bridge) shows these links in Shopify's own left navigation instead.
 * Created with createElement because these are custom elements, not React components.
 */
export function AppNav() {
  return createElement(
    "s-app-nav",
    null,
    ...EMBEDDED_NAV.map((item) => createElement("s-link", { key: item.href, href: item.href }, item.label)),
  );
}
