import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const word = 'LINEBREAKER';
const block = 32;
const quarter = block / 4;
const padX = 2 * block;
const padY = block;
const { glyphs } = JSON.parse(readFileSync(new URL('press-start-2p.json', import.meta.url), 'utf8'));
const rows = Math.max(...Object.values(glyphs).map(glyph => glyph.findLastIndex(line => line.includes('#')))) + 1;
const middle = Math.floor(rows / 2);

const colors = ['#13bedf', '#e9b91c', '#bc42e5', '#54c72b', '#ed3a50', '#3285ef',
  '#86c629', '#f28b23', '#d349cc', '#30c579', '#407de3'];

let cursor = padX;
const letters = [...word].map((letter, index) => {
  const glyph = glyphs[letter];
  const start = cursor;
  const first = Math.min(...glyph.filter(line => line.includes('#')).map(line => line.indexOf('#')));
  const last = Math.max(...glyph.map(line => line.lastIndexOf('#')));
  const end = start + (last - first + 1) * block;
  const cells = glyph.flatMap((line, row) => [...line].flatMap((mark, column) => mark === '#'
    ? [{ row, column, x: start + (column - first) * block, y: padY + row * block }]
    : []));
  cursor = end + block;
  return { color: colors[index], cells, start, end, rowCells: cells.filter(cell => cell.row === middle) };
});
const artWidth = letters.at(-1).end + padX;
const artHeight = 2 * padY + rows * block;
const rowY = padY + middle * block;

function tint(color, amount) {
  return '#' + color.slice(1).match(/../g).map(component => {
    const channel = Number.parseInt(component, 16);
    const target = amount < 0 ? 0 : 255;
    return Math.round(channel + (target - channel) * Math.abs(amount)).toString(16).padStart(2, '0');
  }).join('');
}

function rect(x, y, width, height, fill) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function bevel(color) {
  return `${rect(0, 0, block, block, tint(color, -.5))}
<path d="M0 0H32L27 5H5Z" fill="${tint(color, .32)}"/>
<path d="M0 0L5 5V27L0 32Z" fill="${tint(color, .17)}"/>
<path d="M32 0V32L27 27V5Z" fill="${tint(color, -.27)}"/>
${rect(5, 5, 22, 22, color)}
${rect(3, 2, 12, 2, tint(color, .8))}`;
}

function solidCell({ x, y, row, column }, { color }, index) {
  return `<g data-logo-cell="${index}:${row}:${column}" transform="translate(${x} ${y})">${bevel(color)}</g>`;
}

function hotRow() {
  return letters.map(({ color, start, end, rowCells }, index) => {
    const width = end - start;
    const jogCell = rowCells[Math.floor((rowCells.length - 1) / 2)];
    const jog = jogCell.x - start + (index % 2 ? 12 : 20);
    const leftY = index % 2 ? 18 : 13;
    const rightY = 31 - leftY;
    const step = leftY < rightY ? -3 : 3;
    const upper = `M0 ${leftY - 3}H${jog}V${rightY - 3}H${width}`;
    const lower = `M0 ${leftY + 3}H${jog + step}V${rightY + 3}H${width}`;
    const tileClip = `logo-v3-tiles-${index}`;
    const splitClip = `logo-v3-split-${index}`;
    return `<g data-logo-hot-letter="${index}" transform="translate(${start} ${rowY})">
<defs>
<clipPath id="${tileClip}">${rowCells.map(({ x }) => rect(x - start, 0, block, block, '#fff')).join('')}</clipPath>
<clipPath id="${splitClip}"><path d="${upper}V0H0Z ${lower}V32H0Z"/></clipPath>
</defs>
<g clip-path="url(#${tileClip})"><g clip-path="url(#${splitClip})">
${rowCells.map(({ x }) => `<g transform="translate(${x - start} 0)">${bevel(tint(color, .48))}</g>`).join('\n')}
<path d="${upper} ${lower}" fill="none" stroke="${tint(color, .82)}" stroke-width="20"/>
<path data-logo-core="" d="${upper} ${lower}" fill="none" stroke="#fffdf5" stroke-width="12"/>
</g></g></g>`;
  }).join('\n');
}

function halo() {
  return `<g data-logo-halo="" filter="url(#logo-v3-halo)" shape-rendering="auto">${letters.map(({ color, rowCells }) =>
    rowCells.map(({ x }) => rect(x - 4, rowY + 2, block + 8, 28, tint(color, .16))).join('')).join('\n')}</g>`;
}

function shards() {
  const landings = [
    [0, 'left', -2, -2, 1], [0, 'right', 1, 4, 2], [1, 'right', 2, -3, 1],
    [2, 'right', 1, -1, 2], [3, 'right', 1, 5, 1], [4, 'right', 1, 4, 2],
    [5, 'right', 2, -2, 1], [6, 'right', 1, -2, 2], [7, 'right', 2, 5, 1],
    [8, 'right', 1, 3, 2], [9, 'right', 1, -3, 1], [10, 'right', 2, -1, 2],
  ];
  return landings.map(([index, side, horizontal, vertical, scale]) => {
    const { start, end, color, rowCells } = letters[index];
    const size = scale * quarter;
    const x = (side === 'left' ? start : end) + horizontal * quarter;
    const y = rowY + vertical * quarter;
    const fromX = side === 'left' ? rowCells[0].x : rowCells.at(-1).x + block - size;
    const fromY = rowY + quarter;
    return `<g data-logo-shard="" data-logo-from-x="${fromX - x}" data-logo-from-y="${fromY - y}">
${rect(x, y, size, size, tint(color, -.2))}
${rect(x, y, size - 2, size - 2, tint(color, .48))}
${rect(x, y, size - 2, 2, tint(color, .87))}</g>`;
  }).join('\n');
}

export function renderBlocksLogo({ effects = true } = {}) {
  const solid = keep => letters.flatMap((letter, index) => letter.cells.filter(keep)
    .map(cell => solidCell(cell, letter, index))).join('\n');
  const middleRow = solid(cell => cell.row === middle);
  const layers = effects ? `<defs><filter id="logo-v3-halo" filterUnits="userSpaceOnUse" x="0" y="${rowY - block}" width="${artWidth}" height="${block * 3}" color-interpolation-filters="sRGB">
<feGaussianBlur stdDeviation="8"/>
</filter></defs>
<g data-logo-cracked="">${halo()}\n${hotRow()}</g>
<g data-logo-restored="" opacity="0">${middleRow}</g>
<g data-logo-burst="">${shards()}</g>` : middleRow;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${artWidth}" height="${artHeight}" viewBox="0 0 ${artWidth} ${artHeight}" role="img" aria-label="Linebreaker" data-logo-block="${block}">
<title>Linebreaker</title>
<g shape-rendering="crispEdges">
<g data-logo-top="">${solid(cell => cell.row < middle)}</g>
<g data-logo-base="">${solid(cell => cell.row > middle)}</g>
${layers}
</g>
</svg>\n`;
}

const storeGlyphs = {
  L: [70, 'M0 0H28V73H70V100H0Z'],
  I: [21, 'M0 0h21v21H0Z M0 26h21v21H0Z M0 53h21v21H0Z M0 79h21v21H0Z'],
  N: [89, 'M0 0H27L62 47V0H89V100H62L27 53V100H0Z'],
  E: [68, 'M0 0H68V23H28V37H65V62H28V77H68V100H0Z'],
  B: [81, 'M0 0H47C66 0 77 11 77 27C77 36 73 43 65 47C76 51 81 59 81 71C81 89 69 100 49 100H0Z M27 22V38H42C49 38 52 35 52 30S49 22 42 22Z M27 62V78H45C52 78 55 75 55 70S52 62 45 62Z'],
  R: [82, 'M0 0H45C67 0 80 13 80 33C80 49 72 60 59 64L82 100H51L27 66V100H0Z M27 23V42H42C49 42 53 38 53 32S49 23 42 23Z'],
  A: [100, 'M37 0H63L100 100H71L65 84H35L29 100H0Z M43 61H57L50 35Z'],
  K: [84, 'M0 0H27V33L53 0H84L48 48L84 100H53L27 66V100H0Z'],
};

export function renderStoreLogo() {
  let x = 0;
  const spacing = 9;
  const paths = [...word].map(letter => {
    const [width, path] = storeGlyphs[letter];
    const markup = `<path transform="translate(${x} 0)"${letter === 'I' ? ' fill="#00d8ef"' : ''} d="${path}"/>`;
    x += width + spacing;
    return markup;
  }).join('\n');
  const width = x - spacing;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 32}" height="124" viewBox="-16 -12 ${width + 32} 124" role="img" aria-label="Linebreaker">
<title>Linebreaker</title>
<defs><clipPath id="store-cut"><path d="M0 0H${width}V47H0Z M0 53H${width}V100H0Z"/></clipPath></defs>
<g fill="#f6f8ff" fill-rule="evenodd" clip-path="url(#store-cut)">
${paths}
</g>
</svg>\n`;
}

const root = new URL('../../', import.meta.url);

function writeOutputs(args) {
  const blocks = renderBlocksLogo();
  const store = renderStoreLogo();
  const source = fileURLToPath(new URL('assets/ui/logo-blocks.svg', root));
  const demo = args.indexOf('--demo');
  if (demo !== -1 && (!args[demo + 1] || !args[demo + 2] || !args[demo + 3])) {
    throw new Error('--demo requires an output HTML path, a V1 SVG path, and a V2 SVG path');
  }
  const previous = demo === -1 ? [] : args.slice(demo + 2, demo + 4).map(path => readFileSync(path, 'utf8'));
  writeFileSync(source, blocks);
  writeFileSync(new URL('assets/ui/logo-store.svg', root), store);

  if (!args.includes('--svg-only')) {
    const output = fileURLToPath(new URL('assets/ui/logo-blocks@4k.png', root));
    const width = 3840;
    const height = Math.round(width * artHeight / artWidth);
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'svg_pipe', '-c:v', 'librsvg',
      '-width', String(width), '-height', String(height), '-i', source,
      '-frames:v', '1', '-pix_fmt', 'rgba', '-y', output], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      throw new Error(`PNG export needs FFmpeg with librsvg (or use --svg-only): ${result.error ?? result.stderr}`);
    }
  }

  if (demo !== -1) {
    const svgUrl = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const animation = readFileSync(new URL('logo-anim.js', root), 'utf8');
    const template = readFileSync(new URL('blocks-demo.html', import.meta.url), 'utf8');
    const parts = { V1_URL: svgUrl(previous[0]), V2_URL: svgUrl(previous[1]), STORE_URL: svgUrl(store), BLOCKS: blocks,
      CLEAN_URL: svgUrl(renderBlocksLogo({ effects: false })), ANIMATION: animation };
    writeFileSync(args[demo + 1], template.replace(/\{\{(\w+)\}\}/g, (_, name) => parts[name]));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeOutputs(process.argv.slice(2));
}
