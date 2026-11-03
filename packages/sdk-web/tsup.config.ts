import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  entry: { "tally-embed": "src/index.ts" },
  format: ["esm", "cjs", "iife"],
  globalName: "TallyEmbed",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: true,
  target: "es2018",
  outDir: "dist",
  outExtension({ format }) {
    if (format === "esm") return { js: ".esm.js" };
    if (format === "cjs") return { js: ".cjs.js" };
    return { js: ".min.js" };
  },
  banner: {
    js: `/*! @qorelly/tally-embed v${pkg.version} | (c) ${new Date().getFullYear()} Core Technologies LTD */`,
  },
});
