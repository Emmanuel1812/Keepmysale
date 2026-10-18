import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppBridgeFetch } from "@/components/shopify/app-bridge-fetch";
import { APP_BRIDGE_LOADER } from "@/lib/shopify/app-bridge-loader";

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
        {/* Shopify App Bridge, loaded only when framed inside the Shopify admin (see app-bridge-loader.ts).
            The api key is the public client id. */}
        <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY ?? ""} />
        <script dangerouslySetInnerHTML={{ __html: APP_BRIDGE_LOADER }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#f8fafb] text-[#111827]">
        <AppBridgeFetch />
        {children}
      </body>
    </html>
  );
}
