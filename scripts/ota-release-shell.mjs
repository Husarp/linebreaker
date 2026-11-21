import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import {root, config, apkName, apkMetadataName} from './ota-config.mjs';
import {ensureKeys} from './ota-bundle.mjs';
try {
  const [code,...extra] = process.argv.slice(2);
  if (!/^[1-9][0-9]{0,9}$/.test(code || '') || Number(code) > 2100000000 || extra.length) throw new Error('Usage: npm run android:ota:shell -- <versionCode>');
  const signingKey = ensureKeys();
  const m=JSON.parse(fs.readFileSync(path.join(root,'dist/apk',apkMetadataName(code))));
  const apk=path.join(root,'dist/apk',apkName(code)), bytes=fs.readFileSync(apk);
  if (m.versionCode!==Number(code) || m.apk!==path.basename(apk) || m.size!==bytes.length || m.sha256!==crypto.createHash('sha256').update(bytes).digest('hex')) throw new Error('Build metadata/APK mismatch; rebuild');
  const out=path.join(root,`dist/shell-${code}`);
  if (fs.existsSync(out)) throw new Error('Shell release exists; remove unpublished output explicitly to replace');
  const releasedAt=m.releasedAt || Date.now();
  const payload=Buffer.from(JSON.stringify({schema:1,...m,notes:`${config.appName} shell ${m.versionName} · shellApi ${m.shellApi}`,releasedAt,expiresAt:releasedAt+365*86400000}));
  const signature=crypto.sign(null,payload,signingKey);
  fs.mkdirSync(out,{recursive:true}); fs.copyFileSync(apk,path.join(out,m.apk));
  fs.writeFileSync(path.join(out,config.artifacts.shellManifest),JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')},null,2)+'\n');
  console.log(`Prepared dist/shell-${code}: signed ${config.artifacts.shellManifest} + ${m.apk}. Nothing published.`);
} catch(e) { console.error(e.message); process.exitCode=1; }
