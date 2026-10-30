import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Shopify requires this header for embedded apps; it also stops any other site framing the app. 'self' is needed because the homepage at / shows public/homepage2.html in an iframe.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
