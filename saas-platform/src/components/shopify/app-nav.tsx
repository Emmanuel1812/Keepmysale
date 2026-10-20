"use client";

import { createElement } from "react";
import { NAV_LINKS } from "@/components/layout/nav-links";

export const EMBEDDED_NAV: ReadonlyArray<{ href: string; label: string }> = NAV_LINKS.map(({ href, label }) => ({ href, label }));

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
