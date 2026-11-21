import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const localMusic = process.argv.includes('--local-music');
const catalogue = JSON.parse(await readFile('assets/music.release.json', 'utf8'));
for (const tracks of Object.values(catalogue)) {
  if (tracks.some(track => !track.synth || Object.hasOwn(track, 'file'))) {
    throw new Error('The release music catalogue must contain only synth tracks');
  }
}

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
if (localMusic) {
  const local = JSON.parse(await readFile('assets/music.json', 'utf8'));
  const legacyMusicFiles = new Map([
    ['Classic Block Theme.mp3', 'Original \u0054etris theme (\u0054etris Soundtrack).mp3'],
    ['Block Theme (Hardcore Remix).mp3', '\u0054etris (Hardcore Remix).mp3'],
  ]);
  const files = await readdir('assets/music', { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const available = new Set(files.filter(file => file.isFile() && /\.mp3$/i.test(file.name)).map(file => file.name));
  const copied = new Set();
  for (const category of Object.keys(catalogue)) {
    const candidates = category === 'intense' ? [...(local.intense || []), ...(local.action || [])] : local[category] || [];
    for (const track of candidates) {
      const source = available.has(track.file) ? track.file : legacyMusicFiles.get(track.file);
      if (!available.has(source)) continue;
      catalogue[category].push(track);
      if (copied.has(track.file)) continue;
      await mkdir('dist-web/assets/music', { recursive: true });
      await cp('assets/music/' + source, 'dist-web/assets/music/' + track.file);
      copied.add(track.file);
    }
  }
}
await writeFile('dist-web/assets/music.json', JSON.stringify(catalogue, null, 2) + '\n');
