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
for (const file of (await readdir('.')).filter(f => f === 'index.html' || /\.(js|css)$/.test(f))) {
  await cp(file, 'dist-web/' + file);
}
await mkdir('dist-web/ui', { recursive: true });
await cp('ui', 'dist-web/ui', { recursive: true });
await cp('assets/fonts', 'dist-web/assets/fonts', { recursive: true });
if (localMusic) {
  const local = JSON.parse(await readFile('assets/music.json', 'utf8'));
  const files = await readdir('assets/music', { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const available = new Set(files.filter(file => file.isFile() && /\.mp3$/i.test(file.name)).map(file => file.name));
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
