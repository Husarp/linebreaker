import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config, apkName, apkMetadataName } from './ota-config.mjs';

const mode = process.argv[2];
if (!['--audit', '--build'].includes(mode) || process.argv.length !== 3) {
  throw new Error('Use npm run android:release:audit or npm run android:release.');
}

const root = fileURLToPath(new URL('../', import.meta.url));
const android = fileURLToPath(new URL('../android/', import.meta.url));
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
const forbidden = tracked.filter(file => /\.(?:apk|aab|exe|zip|7z|log|jks|keystore|p12|pfx|key|pem|mp3|lbsave|[t]etris)$/i.test(file)
  || /^(?:assets\/music|dist-web|dist|\.local|design|\.loki|\.claude|android\/app\/build|src-tauri\/target)\//.test(file)
  || /(?:^|\/)(?:[^/]*_save\.json|signing\.properties)$/i.test(file));
if (forbidden.length) throw new Error(`Remove private or generated files from Git before release:\n${forbidden.join('\n')}`);
console.log('Android release artifact audit passed.');

if (mode === '--build') {
  const windows = process.platform === 'win32';
  const npm = windows ? 'npm.cmd' : 'npm';
  const gradle = windows ? 'gradlew.bat' : './gradlew';
  const run = (command, args, cwd, env = process.env) => {
    execFileSync(command, args, { cwd, env, stdio: 'inherit', shell: windows });
  };
  const { versionName: version, versionCode, shellApi, webVersion } = config.build;
  const releasedAt = Date.now();
  const stage = new URL('../dist/apk/', import.meta.url);
  const shellApk = new URL(apkName(versionCode), stage);
  const metadata = new URL(apkMetadataName(versionCode), stage);
  const exists = async file => stat(file).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  if (await exists(shellApk) || await exists(metadata)) throw new Error('APK versionCode already staged');
  run(npm, ['test'], root);
  run(process.execPath, ['scripts/ota-prepare-android.mjs', '--release'], root, { ...process.env, LINEBREAKER_SHELL_RELEASED_AT: String(releasedAt) });
  run(gradle, [':app:assembleRelease', `-PshellReleasedAt=${releasedAt}`], android);
  const output = new URL('../android/app/build/releases/', import.meta.url);
  await mkdir(output, { recursive: true });
  const apk = new URL(`Linebreaker-${version}.apk`, output);
  await copyFile(new URL('../android/app/build/outputs/apk/release/app-release.apk', import.meta.url), apk);
  await mkdir(stage, { recursive: true });
  await copyFile(apk, shellApk);
  const bytes = await readFile(shellApk);
  await writeFile(metadata, JSON.stringify({ versionName: version, versionCode, shellApi, embeddedWebVersion: webVersion, releasedAt,
    apk: apkName(versionCode), size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }) + '\n', { flag: 'wx' });
  console.log(`Signed Android release: ${fileURLToPath(apk)}`);
}
