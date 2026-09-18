import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('docs');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, decodeURIComponent(pathname.replace(/^\/hearth-social\//, '')) || 'index.html');
  if (!pathname.startsWith('/hearth-social/') || !file.startsWith(root + sep)) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
}).listen(4173, '127.0.0.1');
