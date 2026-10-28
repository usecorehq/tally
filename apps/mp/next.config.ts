import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Next loads apps/<app>/.env itself; this fills anything missing from the
// repo-root .env (dotenv never overrides keys that are already set).
loadEnv({ path: resolve(__dirname, "../../.env"), quiet: true });

const config: NextConfig = {
  transpilePackages: ["@tally/ui", "@tally/auth"],
  // Stock-take photos go through server actions: ~400 KB after resizing, up to the API's 4 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default config;
