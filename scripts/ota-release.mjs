import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import {config, resolvePath} from './ota-config.mjs';
import {root, versionPattern, buildWeb, inventory, ensureKeys, embedded, deltaFiles} from './ota-bundle.mjs';
import {assertMatchingWeb, stagedApkWeb} from './ota-consistency.mjs';
const args = process.argv.slice(2); const version = args.shift();
const usage = 'Usage: npm run android:ota:bundle -- <version> --kind fix|feature --message "text" [--min-shell N] [--block 1.0.1,...]';
try {
  if (!versionPattern.test(version || '')) throw new Error(usage);
  const opts = {}; const known = ['--kind','--message','--min-shell','--block'];
  while (args.length) {
    const name = args.shift();
    if (!known.includes(name) || !args.length || name in opts) throw new Error(usage);
    opts[name] = args.shift();
  }
  if (!['fix','feature'].includes(opts['--kind']) || typeof opts['--message'] !== 'string') throw new Error(usage);
  if (opts['--message'].length > 10000) throw new Error('Message too long');
  const minShellApi = Number(opts['--min-shell'] || config.build.minShellApi);
  if (!Number.isInteger(minShellApi) || minShellApi < 1 || minShellApi > 2147483647) throw new Error('Invalid --min-shell');
  const blocked = opts['--block'] ? opts['--block'].split(',') : [];
  if (blocked.length > 1000 || blocked.some(x => !versionPattern.test(x))) throw new Error('Invalid blocked version');
  if (blocked.includes(version)) throw new Error('A release cannot block itself');
  const output = path.join(root, 'dist', version);
  if (fs.existsSync(output)) throw new Error('Release already exists; remove it explicitly or choose a fresh version');
  // Use the oldest supported APK baseline even when the local APK embeds newer web.
  // Every supported older APK must have all changed assets available.
  const baseline = embedded();
  if (version.split('.').map(Number).reduce((c,v,i) => c || Math.sign(v - Number(baseline.version.split('.')[i])), 0) <= 0) throw new Error('Release must exceed embedded version');
  const signingKey = ensureKeys();
  const apks = stagedApkWeb().filter(entry => entry.manifest.version === version);
  const work = path.join(root,'.local','release-web',version); fs.rmSync(work,{recursive:true,force:true});
  const releasedAt = apks[0]?.manifest.releasedAt || Date.now();
  buildWeb(work, version, opts['--message'], releasedAt);
  const files = inventory(work);
  const manifest = {schema:1,version,minShellApi,releasedAt,expiresAt:releasedAt + 365*24*60*60*1000,
    kind:opts['--kind'],message:opts['--message'],blocked,files};
  for (const {apk, manifest: baked} of apks) assertMatchingWeb(baked, manifest, apk);
  const payload = Buffer.from(JSON.stringify(manifest));
  const signature = crypto.sign(null,payload,signingKey);
  const baselineRoot = path.dirname(resolvePath(config.bundle.baselineDir));
  const baselines = fs.readdirSync(baselineRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && versionPattern.test(entry.name))
    .map(entry => inventory(path.join(baselineRoot, entry.name)));
  fs.mkdirSync(output,{recursive:true});
  let size = 0;
  for (const f of deltaFiles(files, baselines)) {
    fs.copyFileSync(path.join(work,f.path),path.join(output,f.asset)); size += f.size;
  }
  fs.writeFileSync(path.join(output,config.artifacts.manifest),JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')},null,2)+'\n');
  fs.writeFileSync(path.join(work,'manifest-readable.json'),JSON.stringify(manifest,null,2));
  console.log(`Prepared dist/${version}: ${files.length} inventory entries, ${size} overlay bytes; signed Ed25519. Nothing published.`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
