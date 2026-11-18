import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const windowsTarget = 'x86_64-pc-windows-msvc';
export const projectFiles = {
  config: 'src-tauri/tauri.conf.json', cargo: 'src-tauri/Cargo.toml', npm: 'package.json', lock: 'package-lock.json'
};

export function run(program, args, options = {}) {
  return execFileSync(program, args, { cwd: root, stdio: 'inherit', ...options });
}

export function stableVersion(version) {
  return typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) &&
    version.split('.').every(part => Number(part) <= 65535);
}

function cargoVersionLine(cargo) {
  const section = cargo.match(/(?:^|\r?\n)\[package\]\r?\n([\s\S]*?)(?=\r?\n\[|$)/)?.[1];
  return section?.match(/^version[ \t]*=[ \t]*"([^"]+)"[ \t]*\r?$/m);
}

export async function readVersions() {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const [config, cargo, npm, lock] = await Promise.all(Object.values(projectFiles).map(read));
  const files = { config: JSON.parse(config), cargo, npm: JSON.parse(npm), lock: JSON.parse(lock) };
  const version = files.config.version;
  if (typeof version !== 'string' || !stableVersion(version) ||
    [cargoVersionLine(cargo)?.[1], files.npm.version, files.lock.version, files.lock.packages[''].version]
      .some(value => value !== version)) throw Error('Tauri, Cargo, npm and npm lock versions must match');
  return files;
}

export async function setVersion(files, version) {
  if (!stableVersion(version)) throw Error('Use a stable X.Y.Z version with Windows-compatible components');
  const line = cargoVersionLine(files.cargo);
  const cargo = files.cargo.replace(line[0], line[0].replace(`"${line[1]}"`, `"${version}"`));
  const write = (path, text) => writeFile(new URL(`../${path}`, import.meta.url), text);
  const json = value => JSON.stringify(value, null, 2) + '\n';
  files.config.version = files.npm.version = files.lock.version = files.lock.packages[''].version = version;
  await Promise.all([
    write(projectFiles.config, json(files.config)), write(projectFiles.cargo, cargo),
    write(projectFiles.npm, json(files.npm)), write(projectFiles.lock, json(files.lock))
  ]);
}

export async function releaseRepository(config) {
  const endpoint = config.plugins.updater.endpoints[0];
  const repository = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/releases\/latest\/download\/latest\.json$/.exec(endpoint)?.[1];
  const capability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/default.json', import.meta.url)));
  const opener = capability.permissions.find(permission => permission.identifier === 'opener:allow-open-url');
  if (!repository || !opener?.allow?.some(rule => rule.url === `https://github.com/${repository}/releases*`)) {
    throw Error('Set the GitHub updater endpoint and matching release-page opener permission');
  }
  const key = config.plugins.updater.pubkey;
  if (!key || key.includes('PLACEHOLDER')) throw Error('Set the real updater public key before building');
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY) throw Error('Set TAURI_SIGNING_PRIVATE_KEY outside the repository');
  return repository;
}

export function assertReleaseHygiene() {
  const tracked = run('git', ['ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).split('\0');
  const excluded = tracked.filter(file => /\.(exe|msi|apk|aab|zip|7z|log|key|pfx|p12|pvk|jks|keystore|mp3|tetris)$/i.test(file) ||
    /(?:^|\/)(design|drafts|local-data|\.loki)(?:\/|$)|(?:^|\/)(tetris_save\.json|CHANGELOG\.md)$/i.test(file));
  if (excluded.length) throw Error(`Remove release-excluded tracked files and ignore them:\n${excluded.join('\n')}`);
}
