import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
    rollupOptions: { input: { main: resolve("web/index.html"), callback: resolve("web/callback.html") } },
  },
});
