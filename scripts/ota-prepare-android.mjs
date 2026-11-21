import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config, root, resolvePath } from './ota-config.mjs';
import { buildWeb, embedded, ensureKeys } from './ota-bundle.mjs';

const mode = process.argv[2];
if (![undefined, '--freeze-baseline', '--release'].includes(mode) || process.argv.length > 3) throw new Error('Use --freeze-baseline or --release');
const { webVersion, minShellApi, shellApi, message } = config.build;
const baseline = resolvePath(config.bundle.baselineDir);
const isBaseline = webVersion === config.bundle.baselineVersion;
const releasedAt = Number(process.env.LINEBREAKER_SHELL_RELEASED_AT || 0);
const work = path.join(root, '.local', 'android-web');
if (minShellApi > shellApi || (isBaseline && minShellApi !== config.bundle.baselineMinShellApi)) throw new Error('Inconsistent embedded API requirements');
if (mode === '--release') ensureKeys();
if (mode === '--freeze-baseline') {
  if (!isBaseline || fs.existsSync(baseline)) throw new Error('Freeze only the configured, as-yet-unfrozen baseline');
  fs.mkdirSync(path.dirname(baseline), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(baseline), '.freeze-'));
  try {
    buildWeb(staging, webVersion, message);
    fs.renameSync(staging, baseline);
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
} else if (mode === '--release' && !fs.existsSync(baseline)) {
  throw new Error('Freeze and archive the first APK baseline before a signed build');
}

let source = baseline;
if (!isBaseline || !fs.existsSync(baseline)) {
  fs.rmSync(work, { recursive: true, force: true });
  if (mode === '--release') {
    const archive = path.join(path.dirname(baseline), webVersion);
    if (!fs.existsSync(archive)) {
      buildWeb(work, webVersion, message, releasedAt);
      fs.renameSync(work, archive);
    }
    source = archive;
  } else {
    buildWeb(work, webVersion, message);
    source = work;
  }
}

const webDir = path.relative(root, source).split(path.sep).join('/');
fs.writeFileSync(path.join(root, 'capacitor.config.json'), JSON.stringify({ appId: config.appId, appName: config.appName, webDir }, null, 2) + '\n');
const cap = spawnSync(process.execPath, [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android'], { cwd: root, stdio: 'inherit' });
if (cap.error || cap.status !== 0) throw cap.error || new Error('Capacitor sync failed');
const assets = path.join(root, 'android/app/src/main/assets');
const manifest = embedded(path.join(assets, 'public'), webVersion, minShellApi, isBaseline ? 0 : releasedAt, message);
if (!manifest.files.some(file => file.path === 'index.html') || !manifest.files.some(file => file.path === 'version.js')) throw new Error('Embedded bundle is missing its entrypoint or version');
fs.writeFileSync(path.join(assets, 'embedded-manifest.json'), JSON.stringify(manifest));
fs.copyFileSync(resolvePath(config.signing.publicKey), path.join(assets, 'public-key.b64'));
