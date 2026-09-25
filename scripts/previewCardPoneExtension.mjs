import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../artifacts/card-pone-extension');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json')));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm', '.traineddata': 'application/octet-stream' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/panel.html' : pathname}`);
    if (!file.startsWith(root + sep) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    const sandbox = file === resolve(root, 'sandbox.html');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': manifest.content_security_policy[sandbox ? 'sandbox' : 'extension_pages'] });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4183, '127.0.0.1', () => console.log('Extension preview: http://127.0.0.1:4183/'));
