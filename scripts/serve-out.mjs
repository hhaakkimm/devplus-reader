// Serves out/ under /devplus-reader/ like GitHub Pages does, for the Playwright run.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "/devplus-reader";
const PORT = 3100;
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../out",
);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

// A file for the URL path, or null: directories give their index.html.
async function resolve(pathname) {
  if (pathname !== BASE && !pathname.startsWith(BASE + "/")) return null;
  const file = path.join(OUT, decodeURIComponent(pathname.slice(BASE.length)));
  if (file !== OUT && !file.startsWith(OUT + path.sep)) return null;
  try {
    const s = await stat(file);
    return s.isDirectory() ? path.join(file, "index.html") : file;
  } catch {
    return null;
  }
}

async function send(res, status, file) {
  try {
    const body = await readFile(file);
    res.writeHead(status, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = await resolve(pathname);
  if (file && (await send(res, 200, file))) return;
  if (await send(res, 404, path.join(OUT, "404.html"))) return;
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}).listen(PORT, () => console.log(`serving out/ on :${PORT}${BASE}/`));
