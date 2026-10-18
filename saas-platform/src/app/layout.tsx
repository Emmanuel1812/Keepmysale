import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppBridgeFetch } from "@/components/shopify/app-bridge-fetch";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KeepMySale",
  description: "KeepMySale platform for Shopify merchants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Shopify App Bridge: must be the first script, loaded synchronously from Shopify's CDN.
            Outside the Shopify admin iframe it does nothing. The api key is the public client id. */}
        <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY ?? ""} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#f8fafb] text-[#111827]">
        <AppBridgeFetch />
        {children}
      </body>
    </html>
  );
}
