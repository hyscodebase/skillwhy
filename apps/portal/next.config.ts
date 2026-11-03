import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
const portalRoot = fileURLToPath(new URL(".", import.meta.url));
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: portalRoot },
  outputFileTracingRoot: portalRoot,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};
export default config;
