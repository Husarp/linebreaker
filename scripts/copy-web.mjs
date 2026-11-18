import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('dist-web/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const name of ['index.html', 'app.js', 'style.css', 'portrait.css', 'touch.css', 'touch.js', 'desktop.js', 'assets']) {
  await cp(new URL(name, root), new URL(name, dist), { recursive: true });
}
