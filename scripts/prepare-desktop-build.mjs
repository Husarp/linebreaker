import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)));
const cargo = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
if (!cargo.includes(`version = "${config.version}"`)) throw Error('Cargo and installer versions disagree');
if (config.plugins.updater.pubkey.includes('PLACEHOLDER')) throw Error('Set the real updater public key before building');
if (!process.env.TAURI_SIGNING_PRIVATE_KEY) throw Error('Set TAURI_SIGNING_PRIVATE_KEY outside the repository');
await import('./build-web.mjs');
// Run the characterization suite before Tauri packages the frontend.
const { execFileSync } = await import('node:child_process');
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], { stdio: 'inherit', shell: process.platform === 'win32' });
