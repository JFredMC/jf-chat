// Serves dist/pages like GitHub Pages does: under /jf-chat/, static files
// only, and 404.html (with status 404) for anything else.
// Used by the demo Playwright suite: `yarn serve:pages` after `yarn build:pages`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/pages/', import.meta.url).pathname;
const base = '/jf-chat/';
const port = Number(process.env.PORT ?? 4300);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (path === base.slice(0, -1)) {
    res.writeHead(301, { Location: base }).end();
    return;
  }
  if (path.startsWith(base)) {
    const relative = normalize(path.slice(base.length)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, relative);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (existsSync(file) && statSync(file).isFile()) return send(res, 200, file);
  }
  send(res, 404, join(root, '404.html'));
}).listen(port, () => console.log(`GitHub Pages preview on http://localhost:${port}${base}`));
