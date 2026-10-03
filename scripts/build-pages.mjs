// Builds what GitHub Pages publishes under https://jfredmc.github.io/jf-chat/.
//
// PAGES_MODE=demo (default): the demo (in-browser backend, no server) at the
//   root. Used while the new API is not deployed.
// PAGES_MODE=api: the real app (talks to the API) at the root and the demo
//   under /jf-chat/demo/.
//
// GitHub Pages has no SPA rewrites: 404.html (a copy of index.html) lets deep
// links boot the app. .nojekyll disables Jekyll processing.
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.env.PAGES_MODE || 'demo';
if (!['demo', 'api'].includes(mode)) {
  console.error(`Unknown PAGES_MODE "${mode}" (use demo or api)`);
  process.exit(1);
}
const root = new URL('..', import.meta.url).pathname;
const built = join(root, 'dist/jf-chat/browser');
const out = join(root, 'dist/pages');

function build(configuration, baseHref, target) {
  execSync(`npx ng build --configuration ${configuration} --base-href ${baseHref}`, { cwd: root, stdio: 'inherit' });
  cpSync(built, target, { recursive: true });
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
writeFileSync(join(out, '.nojekyll'), '');
console.log(`GitHub Pages files ready in ${out} (mode: ${mode})`);
