// next.config.ts
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_DOCS_URL:
      process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.grovs.io",
  },
  // Self-hosted containers use Next's traced standalone server so the runtime
  // image contains neither source files nor the full development dependency tree.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  // Pin Turbopack's workspace root to this project. A stray package-lock.json
  // in the home directory otherwise makes Next infer the wrong root, which
  // breaks module resolution/routing (all routes 404).
  turbopack: {
    root: __dirname,
  },
  // output: "export",
  images: {
    unoptimized: true, // ✅ disables Image Optimization
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};
export default withBundleAnalyzer(nextConfig);
