import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { config } from '../scripts/ota-config.mjs';
import { executePublish, publishPlan } from '../scripts/ota-publish.mjs';

it.each([
  ['bundle', '1.0.3', 'Live update 1.0.3 (Android app bundle channel)', 'Fix notes\nSecond line'],
  ['shell', '1002', 'Android app 1.0.2 (shell channel)', 'Shell notes'],
])('publishes signed %s title and notes without changing Latest', (kind, version, title, notes) => {
  const base = mkdtempSync(path.join(tmpdir(), 'ota-publish-'));
  try {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const c = { ...config, signing: { publicKey: 'key.b64' } };
    writeFileSync(path.join(base, c.signing.publicKey), publicKey.export({ format: 'jwk' }).x);
    const web = kind === 'bundle';
    const dir = path.join(base, 'dist', web ? version : `shell-${version}`);
    mkdirSync(dir, { recursive: true });
    const bytes = Buffer.from('test asset');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const asset = web ? `f-${sha256}.bin` : `LinebreakerShell-${version}.apk`;
    const metadata = web ? { version, message: notes, files: [{ asset, sha256, size: bytes.length }] }
      : { versionName: '1.0.2', versionCode: Number(version), apk: asset, notes, sha256, size: bytes.length };
    const payload = Buffer.from(JSON.stringify(metadata));
    writeFileSync(path.join(dir, asset), bytes);
    writeFileSync(path.join(dir, web ? c.artifacts.manifest : c.artifacts.shellManifest), JSON.stringify({
      payload: payload.toString('base64'), signature: sign(null, payload, privateKey).toString('base64'),
    }));
    const plan = publishPlan(kind, version, c, base);
    expect(plan).toMatchObject({ title, notes });
    for (const exists of [true, false]) {
      const calls = [];
      executePublish(plan, args => {
        calls.push(args);
        return { status: 0, stdout: JSON.stringify(exists ? [{ tagName: plan.tag }] : []) };
      });
      expect(calls.slice(1).map(args => args[1])).toEqual(exists ? ['upload', 'upload', 'edit'] : ['create', 'upload', 'upload']);
      expect(calls.find(args => args[1] === (exists ? 'edit' : 'create'))).toEqual([
        'release', exists ? 'edit' : 'create', plan.tag, ...plan.repo, '--prerelease', '--latest=false', '--title', title, `--notes=${notes}`,
      ]);
      expect(calls.filter(args => args[1] === 'upload').map(args => args[3])).toEqual([...plan.payloads, plan.manifest]);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
