import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { config, root } from './ota-config.mjs';

export function readSignedManifest(file, c = config, base = root) {
  const envelope = JSON.parse(fs.readFileSync(file));
  const payload = Buffer.from(envelope.payload, 'base64');
  const publicFile = c.signing.publicKey.startsWith('~/') ? path.join(os.homedir(), c.signing.publicKey.slice(2)) : path.resolve(base, c.signing.publicKey);
  const key = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(fs.readFileSync(publicFile, 'utf8').trim(), 'base64').toString('base64url') }, format: 'jwk' });
  if (!crypto.verify(null, payload, key, Buffer.from(envelope.signature, 'base64'))) throw new Error('Prepared metadata signature invalid');
  return JSON.parse(payload);
}

export function preparedBundle(version, c = config, base = root) {
  if (!/^(0|[1-9][0-9]{0,8})(\.(0|[1-9][0-9]{0,8})){2}$/.test(version || '')) throw new Error('Invalid embedded web version');
  const file = path.join(base, 'dist', version, c.artifacts.manifest);
  if (!fs.existsSync(file)) return null;
  const manifest = readSignedManifest(file, c, base);
  if (manifest.version !== version) throw new Error('Prepared metadata version mismatch');
  return manifest;
}

export function assertMatchingWeb(embedded, bundle, label) {
  if (embedded.version !== bundle.version) return;
  const expected = new Map(bundle.files.map(file => [file.path, file]));
  for (const file of embedded.files) {
    const other = expected.get(file.path);
    if (!other || file.sha256 !== other.sha256 || file.size !== other.size) {
      throw new Error(`${label}: embedded web ${bundle.version} differs from OTA bundle at ${file.path}`);
    }
    expected.delete(file.path);
  }
  if (expected.size) throw new Error(`${label}: embedded web ${bundle.version} is missing ${expected.keys().next().value}`);
}

export function readApkWeb(apk) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'linebreaker-apk-'));
  const member = 'assets/embedded-manifest.json';
  const executable = process.platform === 'win32' ? 'jar.exe' : 'jar';
  const jar = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executable) : executable;
  try {
    execFileSync(jar, ['xf', path.resolve(apk), member], { cwd: work });
    return JSON.parse(fs.readFileSync(path.join(work, member)));
  } catch (error) {
    throw new Error(`Cannot read embedded web manifest from ${apk}: ${error.message}`, { cause: error });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

export function stagedApkWeb(c = config, base = root) {
  const dist = path.join(base, 'dist');
  const stage = path.join(dist, 'apk');
  const apks = fs.existsSync(stage) ? fs.readdirSync(stage).filter(name => name.endsWith('.apk')).map(name => path.join(stage, name)) : [];
  if (fs.existsSync(dist)) {
    for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^shell-[1-9][0-9]*$/.test(entry.name)) continue;
      const apk = path.join(dist, entry.name, c.artifacts.apk.replaceAll('{code}', entry.name.slice(6)));
      if (fs.existsSync(apk)) apks.push(apk);
    }
  }
  return apks.map(apk => ({ apk, manifest: readApkWeb(apk) }));
}
