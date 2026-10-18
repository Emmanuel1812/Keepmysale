"use client";

import { useEffect } from "react";

interface ShopifyGlobal {
  idToken?: () => Promise<string>;
}

declare global {
  interface Window {
    shopify?: ShopifyGlobal;
    __kmsFetchPatched?: boolean;
  }
}

function isOwnApiRequest(url: string): boolean {
  if (url.startsWith("/")) return !url.startsWith("//") && url.startsWith("/api/");
  try {
    const parsed = new URL(url);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function insideAnotherPage(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin top window: certainly framed
  }
}

/**
 * Next.js injects its own async scripts ahead of App Bridge, so `window.shopify` can appear a
 * moment after this code starts. Resolve it when a request is made, and wait briefly if needed.
 */
async function sessionToken(maxWaitMs = 4000): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const idToken = window.shopify?.idToken;
    if (typeof idToken === "function") return idToken();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/**
 * Inside Shopify admin, attach a fresh Shopify session token to every request this app makes
 * to its own /api/. Outside Shopify (keepmysale.com) nothing changes. App Bridge may add the
 * header itself; this makes the app independent of that, and never overwrites an
 * Authorization header that is already set.
 */
export function AppBridgeFetch() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__kmsFetchPatched || !insideAnotherPage()) return;

    const originalFetch = window.fetch.bind(window);
    window.__kmsFetchPatched = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!isOwnApiRequest(url)) return originalFetch(input, init);

      const requestHeaders = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!requestHeaders.has("authorization")) {
        try {
          const token = await sessionToken();
          if (token) requestHeaders.set("authorization", `Bearer ${token}`);
          else console.warn("[app-bridge] no session token available; request sent without one");
        } catch (error) {
          console.warn("[app-bridge] could not get a session token", error);
        }
      }
      return originalFetch(input, { ...init, headers: requestHeaders });
    };
  }, []);

  return null;
}
