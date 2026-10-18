import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Homepage2Client } from "@/components/homepage2-client";
import { isFreshSignedLaunch, isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/auth";
import { MerchantService } from "@/services/merchant-service";

type SearchParams = Record<string, string | string[] | undefined>;

async function installedMerchantForSignedLaunch(sp: SearchParams): Promise<{ shop: string; host: string } | null> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") query.set(key, value);
  }
  const host = query.get("host");
  if (!host || !isFreshSignedLaunch(query)) return null;

  const shop = normalizeShopDomain(query.get("shop") ?? "").toLowerCase();
  if (!isValidShopDomain(shop)) return null;

  try {
    const merchant = await new MerchantService(createSupabaseAdminClient()).findByShopDomain(shop);
    return merchant?.shopifyAccessTokenEncrypted ? { shop, host } : null;
  } catch {
    return null; // any doubt: fall back to the normal install flow
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  if (sp.shop) {
    // Opened from Shopify admin for a shop that is already connected: no need to repeat OAuth
    // (that cost ~6 s per open and re-registered the webhooks every time).
    const launch = await installedMerchantForSignedLaunch(sp);
    if (launch) {
      redirect(`/dashboard?shop=${encodeURIComponent(launch.shop)}&host=${encodeURIComponent(launch.host)}&embedded=1`);
    }
    redirect(`/api/shopify/install?shop=${encodeURIComponent(String(sp.shop))}`);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.getUser();

  return <Homepage2Client />;
}
