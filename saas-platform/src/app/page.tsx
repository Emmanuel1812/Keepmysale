import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing-page";

export default async function Home({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const sp = await searchParams;
  if (sp.shop) {
    redirect(`/api/shopify/install?shop=${sp.shop}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
