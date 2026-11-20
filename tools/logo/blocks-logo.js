import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const word = 'LINEBREAKER';
const block = 32;
const pixel = block / 4;
const subpixel = block / 8;
const rows = 5;
const middle = Math.floor(rows / 2);
const padX = block;
const padY = block * 1.25;

const glyphs = {
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '###.#', '#.###', '#..##', '#...#'],
  E: ['####', '#...', '###.', '#...', '####'],
  B: ['####.', '#..##', '####.', '#..##', '####.'],
  R: ['####.', '#..##', '####.', '#..##', '#...#'],
  A: ['.###.', '.#.#.', '#####', '#...#', '#...#'],
  K: ['#..##', '#.##.', '###..', '#.##.', '#..##'],
};

const colors = ['#18b8d3', '#e9bb28', '#cc4ab9', '#75c645', '#e94a61', '#4288e5',
  '#28b988', '#ea8538', '#9c63e6', '#c5c542', '#4f9edf'];

let cursor = padX;
const letters = [...word].map((letter, index) => {
  const glyph = glyphs[letter];
  const start = cursor;
  const end = start + glyph[0].length * block;
  const cells = glyph.flatMap((line, row) => [...line].flatMap((mark, column) => mark === '#'
    ? [{ row, column, x: start + column * block, y: padY + row * block }]
    : []));
  cursor = end + (index < 2 ? pixel : block / 2);
  return { color: colors[index], cells, end };
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
  return `${rect(0, 0, block, block, tint(color, -.46))}
${rect(0, 0, 29, 28, tint(color, .21))}
${rect(3, 4, 26, 24, color)}
${rect(0, 0, 30, 3, tint(color, .46))}
${rect(30, 0, 2, 30, tint(color, -.29))}
${rect(0, 28, 29, 2, tint(color, -.23))}
${rect(3, 0, 8, 1, tint(color, .82))}`;
}

function solidCell({ x, y, row, column }, { color }, index) {
  return `<g data-logo-cell="${index}:${row}:${column}" transform="translate(${x} ${y})">${bevel(color)}</g>`;
}

const cracks = [
  ['M3 17H9V13H15V19H21V15H29 M15 19V24H18', 'M6 17H9V13H15V19H21'],
  ['M7 14H11V18H17V12H23V16H29 M17 12V8H20', 'M11 18H17V12H23V16'],
  ['M3 18H11V14H15V16H22V20H26', 'M8 18H11V14H15V16H22'],
  ['M3 16H7V20H12V15H20V13H25 M12 20V24', 'M7 20H12V15H20V13'],
  ['M8 15H12V19H16V15H21V11H25V16H29', 'M12 19H16V15H21V11'],
];

const damage = [
  { x: pixel, y: 0, outline: 'M0 0H8V8H16V0H32V32H0Z' },
  { x: 2 * pixel, y: 3 * pixel, outline: 'M0 0H32V32H24V24H16V32H0Z' },
];

const rowCells = letters.flatMap((letter, index) => letter.cells.filter(cell => cell.row === middle)
  .map(cell => ({ ...cell, color: letter.color, index })));

function crackedCell(cell, index) {
  const { x, y, color } = cell;
  const nick = index % 7 === 2 ? 0 : index % 7 === 5 ? 1 : -1;
  const clip = nick < 0 ? '' : ` clip-path="url(#logo-nick-${nick})"`;
  const [crack, core] = cracks[(index * 3 + cell.index) % cracks.length];
  return `<g transform="translate(${x} ${y})"><g${clip}>
${bevel(color)}
<g data-logo-fissure="" fill="none" opacity="1">
<path class="logo-crack-halo" d="${crack}" stroke="${tint(color, -.55)}" stroke-width="4"/>
<path d="${crack}" stroke="${tint(color, .5)}" stroke-width="2.5"/>
<path class="logo-crack-core" d="${core}" stroke="#fff9ec" stroke-width="1.4"/>
</g></g></g>`;
}

function gutterShards() {
  const clusters = [
    [2, 1, -2, 2], [2, 2, 1, 1], [3, 1, 4, 2], [5, 2, -1, 1],
    [6, 1, 6, 2], [6, 2, 3, 1], [8, 1, -3, 2], [8, 3, 3, 1], [9, 2, 4, 1],
  ];
  return clusters.map(([index, offset, height, size]) => {
    const { end, color } = letters[index];
    const detail = size === 1 ? ' class="logo-fine-shard"' : '';
    return `<g data-logo-gutter=""${detail}>${rect(end + offset * subpixel, rowY + height * subpixel,
      size * subpixel, size * subpixel, tint(color, size === 1 ? .2 : -.03))}</g>`;
  }).join('\n');
}

function flyingShards() {
  return rowCells.flatMap(({ x, y, color }, index) => {
    const nick = index % 7 === 2 ? damage[0] : index % 7 === 5 ? damage[1] : null;
    const side = nick ? (nick.y === 0 ? -1 : 1) : index % 2 ? 1 : -1;
    const drift = ((index * 5) % 9 - 4) / 4;
    const fragment = (offsetX, offsetY, size, direction, travel, shade) =>
      `<g data-logo-shard="${direction}" data-logo-drift="${travel}">${rect(x + offsetX, y + offsetY,
        size, size, tint(color, shade))}</g>`;
    return [fragment(nick?.x ?? (index % 3) * pixel, nick?.y ?? (side < 0 ? pixel : 2 * pixel),
      pixel, side, drift, .14),
    fragment(((index + 2) % 4) * pixel, side < 0 ? 3 * pixel : 0, pixel, -side, -drift * .8, -.12)];
  }).join('\n');
}

export function renderBlocksLogo({ effects = true } = {}) {
  const solid = keep => letters.flatMap((letter, index) => letter.cells.filter(keep)
    .map(cell => solidCell(cell, letter, index))).join('\n');
  const middleRow = solid(cell => cell.row === middle);
  const layers = effects ? `<defs>${damage.map(({ outline }, index) =>
    `<clipPath id="logo-nick-${index}"><path d="${outline}"/></clipPath>`).join('')}</defs>
<style>@media (max-width: 480px) {
  .logo-fine-shard, .logo-crack-halo { display: none; }
  .logo-crack-core { stroke-width: 1; }
}</style>
<g data-logo-cracked="">${rowCells.map(crackedCell).join('\n')}
<g>${gutterShards()}</g></g>
<g data-logo-restored="" opacity="0">${middleRow}</g>
<g opacity="0" data-logo-burst="">${flyingShards()}</g>` : middleRow;

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
  if (demo !== -1 && (!args[demo + 1] || !args[demo + 2])) {
    throw new Error('--demo requires an output HTML path and a V1 SVG path');
  }
  const previous = demo === -1 ? '' : readFileSync(args[demo + 2], 'utf8');
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
    const parts = { PREVIOUS_URL: svgUrl(previous), STORE_URL: svgUrl(store), BLOCKS: blocks,
      CLEAN_URL: svgUrl(renderBlocksLogo({ effects: false })), ANIMATION: animation };
    writeFileSync(args[demo + 1], template.replace(/\{\{(\w+)\}\}/g, (_, name) => parts[name]));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeOutputs(process.argv.slice(2));
}
