// Static server for the reference page: /pages/* (this lane's pages), /nm/* (this lane's node_modules), /model.glb. Logs every request.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { NODE_MODULES, PAGES } from './paths.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.hdr': 'application/octet-stream' };

export async function startServer({ glbPath }) {
  const log = [];
  const within = (root, rel) => { const abs = path.resolve(root, '.' + path.sep + rel); return abs.startsWith(root + path.sep) ? abs : null; };
  const send = (res, file) => {
    let st; try { st = fs.statSync(file); } catch { return false; }
    if (!st.isFile()) return false;
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
    return true;
  };
  const server = http.createServer((req, res) => {
    let p = ''; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { /* 404 */ }
    const entry = { path: p, status: 404 }; log.push(entry); res.on('finish', () => { entry.status = res.statusCode; });
    let ok = false;
    if (p === '/model.glb') ok = send(res, glbPath);
    else if (p.startsWith('/pages/')) { const a = within(PAGES, p.slice(7)); ok = !!a && send(res, a); }
    else if (p.startsWith('/nm/')) { const a = within(NODE_MODULES, p.slice(4)); ok = !!a && send(res, a); }
    if (!ok) { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r, j) => { server.once('error', j); server.listen(0, '127.0.0.1', r); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, log, close: () => new Promise((r) => server.close(() => r())) };
}
