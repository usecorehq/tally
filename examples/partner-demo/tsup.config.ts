import { defineConfig } from "tsup";

// One self-contained file, so the runtime image needs no node_modules.
export default defineConfig({
  entry: { server: "server/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: false,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".mjs" }),
});
