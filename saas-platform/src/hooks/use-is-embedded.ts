"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Hook to detect if the app is being viewed inside an iframe (embedded mode).
 * This is primarily used to hide navigation elements when inside Shopify Admin.
 */
export function useIsEmbedded() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Check if the app is in an iframe
    const inIframe = window.self !== window.top;
    
    // 2. Check for explicit Shopify embedded flag
    const isExplicitlyEmbedded = searchParams.get("embedded") === "1";

    // 3. Update state
    setIsEmbedded(inIframe || isExplicitlyEmbedded);
  }, [searchParams]);

  return isEmbedded;
}
