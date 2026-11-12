// Tiny static server for the exported site in out/ (no base path).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "out");
const port = Number(process.env.E2E_PORT ?? 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const rel = path.normalize(url).replace(/^[\\/]+/, "");
  const candidates = [rel, path.join(rel, "index.html"), `${rel}.html`];
  for (const c of candidates) {
    const file = path.join(root, c);
    if (!file.startsWith(root)) break;
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
      return res.end(body);
    } catch {}
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}).listen(port, "127.0.0.1");
