// Android only. Invoked explicitly; build/test never contact GitHub.
// Payloads first, signed metadata last. Retain old payloads for in-flight downloads.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {config, root} from './ota-config.mjs';
export function publishPlan(kind, version, c = config, base = root) {
  const web = kind === 'bundle';
  if (!['bundle','shell'].includes(kind) || !(web ? /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/ : /^[1-9][0-9]{0,9}$/).test(version || '') || (!web && Number(version) > 2100000000)) throw new Error('Specify a prepared bundle version or shell versionCode');
  const tag = c.channels[kind];
  const dir = path.join(base, 'dist', web ? version : `shell-${version}`);
  const manifest = path.join(dir, web ? c.artifacts.manifest : c.artifacts.shellManifest);
  const envelope = JSON.parse(fs.readFileSync(manifest));
  const payload = Buffer.from(envelope.payload,'base64');
  // Provisioned public key only: publishing never needs the private key.
  const publicFile = c.signing.publicKey.startsWith('~/') ? path.join(process.env.HOME,c.signing.publicKey.slice(2)) : path.resolve(base,c.signing.publicKey);
  const key = crypto.createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(fs.readFileSync(publicFile,'utf8').trim(),'base64').toString('base64url')},format:'jwk'});
  if (!crypto.verify(null,payload,key,Buffer.from(envelope.signature,'base64'))) throw new Error('Prepared metadata signature invalid');
  const m = JSON.parse(payload);
  if (web ? m.version !== version : m.versionCode !== Number(version)) throw new Error('Prepared metadata version mismatch');
  const names = web ? [...new Set(m.files.map(f=>f.asset))].filter(name=>fs.existsSync(path.join(dir,name))) : [m.apk];
  if (!web && m.apk !== c.artifacts.apk.replaceAll('{code}', version)) throw new Error('APK name/config mismatch');
  for (const name of names) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error('Unsafe prepared asset name');
    const bytes = fs.readFileSync(path.join(dir,name));
    const entry = web ? m.files.find(f=>f.asset===name) : m;
    if (bytes.length !== entry.size || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Prepared asset changed: ${name}`);
  }
  const repo = ['--repo',`${c.github.owner}/${c.github.repo}`];
  return {tag, repo, title:web ? `Live update ${m.version} (Android app bundle channel)` : `Android app ${m.versionName} (shell channel)`, notes:web ? m.message : m.notes,
    payloads:names.map(name=>path.join(dir,name)), manifest};
}
export function executePublish(plan, gh = args => {
  const result = spawnSync('gh',args,{encoding:'utf8'});
  if (result.error) throw result.error;
  return result;
}) {
  const run = args => { const r = gh(args); if (r.status !== 0) throw new Error(r.stderr || 'gh command failed'); return r; };
  // Listing must succeed: an auth/network failure must never be treated as a missing release.
  const releases = JSON.parse(run(['release','list',...plan.repo,'--limit','1000','--json','tagName']).stdout);
  const exists = releases.some(r=>r.tagName===plan.tag);
  const metadata = [...plan.repo,'--prerelease','--latest=false','--title',plan.title,`--notes=${plan.notes}`];
  if (!exists) run(['release','create',plan.tag,...metadata]);
  // Hash-addressed payloads and versioned APKs stay available across channel changes.
  // Only the small metadata asset changes meaning. Do not delete/recreate the release.
  // Batch below GitHub/OS argument limits for applications with many files.
  for (let i=0;i<plan.payloads.length;i+=50) run(['release','upload',plan.tag,...plan.payloads.slice(i,i+50),...plan.repo,'--clobber']);
  run(['release','upload',plan.tag,plan.manifest,...plan.repo,'--clobber']);
  if (exists) run(['release','edit',plan.tag,...metadata]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: publish.mjs bundle|shell <prepared-version>');
    executePublish(publishPlan(process.argv[2],process.argv[3]));
    console.log('Updated fixed Android OTA channel; normal releases retain Latest.');
  } catch (e) { console.error(e.message); process.exitCode=1; }
}
