import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const sp = await searchParams;
  if (sp.shop) {
    redirect(`/api/shopify/install?shop=${sp.shop}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">ReturnShield SaaS Platform</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        Greenfield multi-tenant support automation platform (email-first with SES, Shopify, OpenAI, and Supabase).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <a className="rounded-lg border p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/onboarding">
          Open merchant onboarding
        </a>
        <a className="rounded-lg border p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/dashboard">
          Open dashboard
        </a>
      </div>
    </main>
  );
}
