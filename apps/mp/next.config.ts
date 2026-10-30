import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Next loads apps/<app>/.env itself; this fills anything missing from the
// repo-root .env (dotenv never overrides keys that are already set).
loadEnv({ path: resolve(__dirname, "../../.env"), quiet: true });

const config: NextConfig = {
  transpilePackages: ["@tally/ui", "@tally/auth"],
  // Stock-take photos go through server actions: ~1-2 MB after resizing (2560 px long edge), up to the API's 4 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // The consent screen must never load inside another site's frame (clickjacking).
  async headers() {
    return [
      {
        source: "/oauth/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
