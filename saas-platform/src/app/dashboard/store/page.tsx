"use client";

import { useEffect, useState } from "react";

interface MerchantProfile {
  merchant: {
    id: string;
    shopDomain: string;
    shopName: string | null;
    email: string;
    onboardingCompleted: boolean;
    settings: Record<string, unknown> | null;
  };
  user: {
    id: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
  } | null;
}

export default function StoreDataPage() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const response = await fetch("/api/merchant/profile", { cache: "no-store" });
      const payload = (await response.json()) as { success: boolean; data?: MerchantProfile };
      if (payload.success && payload.data) {
        setProfile(payload.data);
      }
      setLoading(false);
    }
    void loadProfile();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Store Data</h1>
      {loading ? <div className="rounded-lg border p-4 text-sm">Loading...</div> : null}
      {!loading && profile ? (
        <>
          <div className="rounded-lg border p-4 text-sm">
            <h2 className="mb-2 font-medium">Merchant</h2>
            <p>ID: {profile.merchant.id}</p>
            <p>Shop Domain: {profile.merchant.shopDomain}</p>
            <p>Shop Name: {profile.merchant.shopName ?? "-"}</p>
            <p>Support Email: {profile.merchant.email}</p>
            <p>Onboarding Completed: {String(profile.merchant.onboardingCompleted)}</p>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <h2 className="mb-2 font-medium">Logged-in User</h2>
            <p>User ID: {profile.user?.id ?? "-"}</p>
            <p>Email: {profile.user?.email ?? "-"}</p>
            <p>Created At: {profile.user?.createdAt ?? "-"}</p>
            <p>Last Sign In: {profile.user?.lastSignInAt ?? "-"}</p>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <h2 className="mb-2 font-medium">Raw Settings JSON</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(profile.merchant.settings ?? {}, null, 2)}
            </pre>
          </div>
        </>
      ) : null}
    </div>
  );
}
