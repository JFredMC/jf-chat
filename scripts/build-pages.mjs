// Builds what GitHub Pages publishes under https://jfredmc.github.io/jf-chat/.
//
// PAGES_MODE=demo (default): the demo (in-browser backend, no server) at the
//   root. Used while the new API is not deployed.
// PAGES_MODE=api: the real app (talks to the API) at the root and the demo
//   under /jf-chat/demo/.
//
// GitHub Pages has no SPA rewrites: 404.html (a copy of index.html) lets deep
// links boot the app; in api mode it also forwards deep links into the demo. .nojekyll disables Jekyll processing.
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.env.PAGES_MODE || 'demo';
if (!['demo', 'api'].includes(mode)) {
  console.error(`Unknown PAGES_MODE "${mode}" (use demo or api)`);
  process.exit(1);
}
const root = new URL('..', import.meta.url).pathname;
const built = join(root, 'dist/jf-chat/browser');
const out = join(root, 'dist/pages');

// The CSP in src/index.html also allows the local API for development;
// what is published must not.
function hardenCsp(file) {
  const html = readFileSync(file, 'utf8');
  const strict = html.replace(/ (?:https?|wss?):\/\/localhost:\d+/g, '');
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(strict)?.[1];
  if (!csp || /localhost/.test(csp)) throw new Error(`CSP missing or still allowing localhost in ${file}`);
  writeFileSync(file, strict);
}

function build(configuration, baseHref, target) {
  execSync(`npx ng build --configuration ${configuration} --base-href ${baseHref}`, { cwd: root, stdio: 'inherit' });
  cpSync(built, target, { recursive: true });
  hardenCsp(join(target, 'index.html'));
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (mode === 'api') {
  build('production', '/jf-chat/', out);
  build('demo', '/jf-chat/demo/', join(out, 'demo'));
} else {
  build('demo', '/jf-chat/', out);
}
if (!existsSync(join(out, 'index.html'))) throw new Error('index.html missing');
copyFileSync(join(out, 'index.html'), join(out, '404.html'));
if (mode === 'api') {
  // Deep links into the demo also land on this 404.html: boot.js sends them
  // on to the demo app (see public/boot.js).
  const notFound = join(out, '404.html');
  const html = readFileSync(notFound, 'utf8');
  const tagged = html.replace('<head>', '<head>\n    <meta name="velo-nested-app" content="/jf-chat/demo/" />');
  if (tagged === html) throw new Error('could not tag 404.html');
  writeFileSync(notFound, tagged);
}
writeFileSync(join(out, '.nojekyll'), '');
console.log(`GitHub Pages files ready in ${out} (mode: ${mode})`);
