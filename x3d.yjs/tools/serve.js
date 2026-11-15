import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
const defaultRoot = path.resolve(import.meta.dirname, '..')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' }
export function serve(port = 0, root = process.env.SERVE_ROOT || defaultRoot) {
  root = path.resolve(root)
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p.startsWith('/xite/')) p = '/node_modules/x_ite/dist/' + p.slice(6)
    const f = path.join(root, p)
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf') }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
  })
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)))
}
if (import.meta.url === 'file://' + process.argv[1]) { const s = await serve(+process.argv[2] || 8080); console.log('http://127.0.0.1:' + s.address().port + '/demo/index.html') }
