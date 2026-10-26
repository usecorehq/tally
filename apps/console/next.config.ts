import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// One env file at the repo root for every app.
loadEnv({ path: resolve(__dirname, "../../.env"), quiet: true });

const config: NextConfig = {
  transpilePackages: ["@tally/ui", "@tally/auth"],
};

export default config;
