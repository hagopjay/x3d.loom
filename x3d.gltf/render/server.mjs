// Tiny static HTTP server for the render pages. Everything the browser may fetch is listed here:
//
//   /pages/*      render/pages/*             (the three engine pages)
//   /nm/*         ../node_modules/*          (engines + decoders; nothing outside node_modules)
//   /model.glb    the glb being rendered
//   /wrapper.x3d  generated X3D wrapper (X_ITE only)
//
// Every request is logged, so the receipt can say which decoder assets were really fetched.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NODE_MODULES = path.resolve(HERE, '..', 'node_modules');
const PAGES = path.join(HERE, 'pages');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2',
  '.x3d': 'model/x3d+xml',
  '.map': 'application/json',
};

export async function startServer({ glbPath, wrapperX3d = null } = {}) {
  const log = [];
  const sendFile = (res, file, status = 200) => {
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      return false;
    }
    if (!st.isFile()) return false;
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
    return true;
  };
  const within = (root, rel) => {
    const abs = path.resolve(root, '.' + path.sep + rel);
    return abs === root || abs.startsWith(root + path.sep) ? abs : null;
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let p;
    try {
      p = decodeURIComponent(url.pathname);
    } catch {
      p = '';
    }
    const entry = { method: req.method, path: p, status: 404 };
    log.push(entry);
    res.on('finish', () => {
      entry.status = res.statusCode;
    });
    const notFound = () => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    };
    if (p === '/model.glb' && glbPath) {
      if (!sendFile(res, glbPath)) notFound();
    } else if (p === '/wrapper.x3d' && wrapperX3d) {
      const body = Buffer.from(wrapperX3d);
      res.writeHead(200, { 'Content-Type': MIME['.x3d'], 'Content-Length': body.length, 'Cache-Control': 'no-store' });
      res.end(body);
    } else if (p.startsWith('/pages/')) {
      const abs = within(PAGES, p.slice('/pages/'.length));
      if (!abs || !sendFile(res, abs)) notFound();
    } else if (p.startsWith('/nm/')) {
      const abs = within(NODE_MODULES, p.slice('/nm/'.length));
      if (!abs || !sendFile(res, abs)) notFound();
    } else {
      notFound();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    log,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
