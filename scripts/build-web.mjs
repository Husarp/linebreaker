import { cp, mkdir, readdir, rm } from 'node:fs/promises';

await rm('dist-web', { recursive: true, force: true });
await mkdir('dist-web/assets', { recursive: true });
await mkdir('dist-web/ui', { recursive: true });
for (const file of ['index.html', 'app.js', 'save-sanitize.js', 'style.css', 'desktop.js', 'native-save.js', 'touch.js', 'touch.css']) {
  await cp(file, 'dist-web/' + file);
}
await cp('assets/fonts', 'dist-web/assets/fonts', { recursive: true });
await cp('assets/music.json', 'dist-web/assets/music.json');
const tracks = await readdir('assets/music').catch(error => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
for (const track of tracks.filter(name => name.toLowerCase().endsWith('.mp3'))) {
  await mkdir('dist-web/assets/music', { recursive: true });
  await cp('assets/music/' + track, 'dist-web/assets/music/' + track);
}

await cp('ui/tokens.css', 'dist-web/ui/tokens.css', { recursive: true });
