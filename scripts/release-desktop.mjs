import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertReleaseHygiene, readVersions, releaseRepository, run, setVersion, stableVersion, windowsTarget } from './desktop-release-config.mjs';

const [version, notesFlag, notesFile, ...extra] = process.argv.slice(2);
if (!version || !stableVersion(version) || extra.length || (notesFlag && (notesFlag !== '--notes-file' || !notesFile))) {
  throw Error('Usage: npm run desktop:release -- X.Y.Z [--notes-file release-notes.md]');
}
if (process.platform !== 'win32') throw Error('Build the Windows release on Windows');
const files = await readVersions();
const repository = await releaseRepository(files.config);
assertReleaseHygiene();
const current = files.config.version.split('.').map(Number);
const requested = version.split('.').map(Number);
if (requested.map((part, index) => part - current[index]).find(Boolean) < 0) throw Error('Cannot release an older version');
const title = `Linebreaker ${version}`;
const notes = notesFile ? await readFile(notesFile, 'utf8') : title;
if (version !== files.config.version) await setVersion(files, version);
const cargoArgs = ['--manifest-path', 'src-tauri/Cargo.toml'];
run(process.execPath, ['scripts/build-web.mjs']);
run('cargo', ['check', ...cargoArgs, '--target', windowsTarget]);
const { target_directory: targetDir } = JSON.parse(run('cargo', ['metadata', '--no-deps', '--format-version', '1', ...cargoArgs],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
const bundled = join(targetDir, windowsTarget, 'release', 'bundle', 'nsis', `Linebreaker_${version}_x64-setup.exe`);
await rm(bundled, { force: true });
await rm(`${bundled}.sig`, { force: true });
run(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'build', '--target', windowsTarget, '--ci']);

const release = join('release', 'windows', version);
await mkdir(release, { recursive: true });
const installer = `LinebreakerSetup-${version}.exe`;
const signature = (await readFile(`${bundled}.sig`, 'utf8')).trim();
if (!signature) throw Error('Tauri did not produce an updater signature');
const { size } = await stat(bundled);
await copyFile(bundled, join(release, installer));
await copyFile(`${bundled}.sig`, join(release, `${installer}.sig`));
const url = `https://github.com/${repository}/releases/download/v${version}/${installer}`;
const latest = { version, notes, pub_date: new Date().toISOString(), platforms: { 'windows-x86_64': { url, signature, size } } };
await writeFile(join(release, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
const stagedNotes = `Linebreaker-${version}-notes.md`;
await writeFile(join(release, stagedNotes), notes);
console.log(`After Windows acceptance testing, publish from ${release}:`);
console.log(`gh release create v${version} "${installer}" "${installer}.sig" latest.json --repo ${repository} --latest --title "${title}" --notes-file "${stagedNotes}" --verify-tag`);
