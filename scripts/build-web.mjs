import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { checkWebView } from './webview-compat.mjs';

const localMusic = process.argv.includes('--local-music');
const catalogue = JSON.parse(await readFile('assets/music.release.json', 'utf8'));
const releaseMusic = Object.values(catalogue).flat().filter(track => {
  if (track.synth && !Object.hasOwn(track, 'file')) return false;
  if (track.synth || track.license !== 'CC0' || !/^[a-z0-9-]+\.ogg$/.test(track.file)) {
    throw new Error(`Invalid release music entry: ${track.title}`);
  }
  return true;
});

await rm('dist-web', { recursive: true, force: true });
await mkdir('dist-web/assets', { recursive: true });
await mkdir('dist-web/ui', { recursive: true });
for (const file of (await readdir('.')).filter(f => f === 'index.html' || f === 'manifest.webmanifest' || /\.(js|css)$/.test(f))) {
  await cp(file, 'dist-web/' + file);
}
await cp('ui', 'dist-web/ui', { recursive: true });
await cp('data', 'dist-web/data', { recursive: true });
await cp('assets/fonts', 'dist-web/assets/fonts', { recursive: true });
await cp('assets/skins', 'dist-web/assets/skins', { recursive: true });
await cp('assets/ui', 'dist-web/assets/ui', { recursive: true, filter: source => !source.endsWith('mythic-rainbow.png') });
if (releaseMusic.length) {
  await mkdir('dist-web/assets/music-release', { recursive: true });
  for (const { file } of releaseMusic) {
    await cp('assets/music-release/' + file, 'dist-web/assets/music-release/' + file);
  }
}
if (localMusic) {
  const local = JSON.parse(await readFile('assets/music.json', 'utf8'));
  const files = await readdir('assets/music', { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const available = new Set(files.filter(file => file.isFile() && /\.ogg$/i.test(file.name)).map(file => file.name));
  const copied = new Set();
  for (const category of Object.keys(catalogue)) {
    const candidates = category === 'intense' ? [...(local.intense || []), ...(local.action || [])] : local[category] || [];
    for (const track of candidates) {
      if (!available.has(track.file)) continue;
      catalogue[category].push(track);
      if (copied.has(track.file)) continue;
      await mkdir('dist-web/assets/music', { recursive: true });
      await cp('assets/music/' + track.file, 'dist-web/assets/music/' + track.file);
      copied.add(track.file);
    }
  }
}
await writeFile('dist-web/assets/music.json', JSON.stringify(catalogue, null, 2) + '\n');
await checkWebView('dist-web', { compile: true });
await checkWebView('dist-web');
