import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Shopify requires this header for embedded apps; it also stops any other site framing the app.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
