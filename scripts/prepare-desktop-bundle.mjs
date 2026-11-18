import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readVersions, releaseRepository, root, run, windowsTarget } from './desktop-release-config.mjs';

if (process.platform !== 'win32' || process.env.TAURI_ENV_TARGET_TRIPLE !== windowsTarget || process.env.TAURI_ENV_DEBUG) {
  throw Error('Bundle Linebreaker on Windows using npm run desktop:build or npm run desktop:release');
}
const { config } = await readVersions();
await releaseRepository(config);
const { target_directory: targetDir } = JSON.parse(run('cargo', ['metadata', '--no-deps', '--format-version', '1',
  '--manifest-path', 'src-tauri/Cargo.toml'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
const binary = join(targetDir, windowsTarget, 'release', 'linebreaker.exe');
const smoke = await mkdtemp(join(tmpdir(), 'linebreaker-smoke-'));
try {
  const output = join(smoke, 'ready');
  run(binary, ['--desktop-smoke-test', output], { timeout: 30000 });
  if (await readFile(output, 'utf8') !== config.version) throw Error('Packaged WebView reported the wrong version');
} finally {
  await rm(smoke, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

const installer = resolve(root, 'src-tauri/installer');
const generated = join(installer, 'generated');
await mkdir(generated, { recursive: true });
const inter = join(generated, 'Inter.ttf');
run('py', ['-3', '-c', [
  'import sys', 'from fontTools.ttLib import TTFont', 'from fontTools.varLib.instancer import instantiateVariableFont',
  'font = TTFont(sys.argv[1])', 'font.flavor = None',
  'axes = {axis.axisTag: axis.defaultValue for axis in font["fvar"].axes}',
  'axes["wght"] = 400', 'instantiateVariableFont(font, axes, inplace=True)',
  'font.save(sys.argv[2])'
].join('\n'), 'assets/fonts/inter/InterVariable.woff2', inter]);

const tokens = (await readFile(resolve(root, 'ui/tokens.css'), 'utf8')).split(':root {')[1].split('}')[0];
const colors = { Surface: 'surface-0', Button: 'surface-2', Accent: 'accent', Ink: 'accent-ink', Text: 'text', Muted: 'text-muted', Border: 'border' };
const definitions = Object.entries(colors).map(([field, token]) => {
  const value = new RegExp(`--${token}: (#[a-f0-9]{6});`, 'i').exec(tokens)?.[1];
  if (!value) throw Error(`Missing setup palette token: --${token}`);
  return `    internal static readonly Color ${field} = ColorTranslator.FromHtml("${value}");`;
});
const palette = join(generated, 'SetupTheme.cs');
await writeFile(palette, `using System.Drawing;\ninternal static class SetupTheme\n{\n${definitions.join('\n')}\n}\n`);

const compiler = join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
run(compiler, ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/codepage:65001',
  `/out:${join(generated, 'LinebreakerMaintenance.exe')}`, `/win32manifest:${join(installer, 'setup.manifest')}`,
  '/win32icon:src-tauri/icons/icon.ico', '/reference:System.Drawing.dll,System.Windows.Forms.dll,Microsoft.CSharp.dll',
  `/resource:${inter},Inter.ttf`, '/resource:assets/fonts/static/Orbitron-Regular.ttf,Orbitron.ttf',
  '/resource:assets/fonts/OFL.txt,Orbitron-OFL.txt', '/resource:assets/fonts/inter/OFL.txt,Inter-OFL.txt',
  join(installer, 'SetupWindow.cs'), join(installer, 'Installation.cs'), palette]);
