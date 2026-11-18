import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!['--audit', '--build'].includes(mode) || process.argv.length !== 3) {
  throw new Error('Use npm run android:release:audit or npm run android:release.');
}

const root = fileURLToPath(new URL('../', import.meta.url));
const android = fileURLToPath(new URL('../android/', import.meta.url));
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
const forbidden = tracked.filter(file => /\.(?:apk|aab|exe|zip|7z|log|jks|keystore|p12|pfx|key|mp3|tetris)$/i.test(file)
  || /^(?:dist-web|design|\.loki|\.claude|android\/app\/build|src-tauri\/target)\//.test(file)
  || /(?:^|\/)tetris_save\.json$/i.test(file));
if (forbidden.length) throw new Error(`Remove private or generated files from Git before release:\n${forbidden.join('\n')}`);
console.log('Android release artifact audit passed.');

if (mode === '--build') {
  const windows = process.platform === 'win32';
  const npm = windows ? 'npm.cmd' : 'npm';
  const gradle = windows ? 'gradlew.bat' : './gradlew';
  const run = (command, args, cwd, env = process.env) => {
    execFileSync(command, args, { cwd, env, stdio: 'inherit', shell: windows });
  };
  const { version } = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  run(npm, ['test'], root);
  run(npm, ['run', 'android:sync'], root, { ...process.env, LINEBREAKER_OMIT_LOCAL_MUSIC: '1' });
  run(gradle, [':app:assembleRelease'], android);
  const output = new URL('../android/app/build/releases/', import.meta.url);
  await mkdir(output, { recursive: true });
  const apk = new URL(`Linebreaker-${version}.apk`, output);
  await copyFile(new URL('../android/app/build/outputs/apk/release/app-release.apk', import.meta.url), apk);
  console.log(`Signed Android release: ${fileURLToPath(apk)}`);
}
