import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Two ports give the host page and the mock embed different origins, like production.
const HOST_PORT = Number(process.env.HOST_PORT ?? 5180);
const EMBED_PORT = HOST_PORT + 1;
const here = fileURLToPath(new URL(".", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".map": "application/json" };

function serve(port, routes) {
  createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    const file = routes(path);
    if (!file) return res.writeHead(404).end("not found");
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  }).listen(port, () => console.log(`http://localhost:${port}`));
}

serve(HOST_PORT, (path) => {
  if (path === "/") return join(here, "index.html");
  if (/^\/dist\/[\w.-]+$/.test(path)) return join(here, "..", path);
  return null;
});
serve(EMBED_PORT, (path) => (path === "/embed/stocktake" ? join(here, "mock-embed.html") : null));
