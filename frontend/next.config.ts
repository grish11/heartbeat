import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // wagmi's Base Account connector reaches into @coinbase/cdp-sdk, whose
  // optional @x402/* payment deps aren't installed and aren't needed. Keep it
  // out of the bundler and let Node resolve it at runtime instead.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
  serverExternalPackages: ["@coinbase/cdp-sdk", "@base-org/account"],
};

export default nextConfig;
