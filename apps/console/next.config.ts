import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Next loads apps/<app>/.env itself; this fills anything missing from the
// repo-root .env (dotenv never overrides keys that are already set).
loadEnv({ path: resolve(__dirname, "../../.env"), quiet: true });

const config: NextConfig = {
  transpilePackages: ["@tally/ui", "@tally/auth"],
};

export default config;
