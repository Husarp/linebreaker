import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const word = 'LINEBREAKER';
const block = 16;
const pixel = block / 4;
const rows = 7;
const middle = Math.floor(rows / 2);
const padX = block;
const padY = 2 * block;

const glyphs = {
  L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '##..#', '###.#', '#.#.#', '#.###', '#..##', '#...#'],
  E: ['####', '#...', '#...', '###.', '#...', '#...', '####'],
  B: ['###.', '#..#', '#..#', '###.', '#..#', '#..#', '###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.##.', '#..##', '#...#'],
  A: ['.###.', '##.##', '#...#', '#####', '#...#', '#...#', '#...#'],
  K: ['#...#', '#..##', '#.##.', '###..', '#.##.', '#..##', '#...#'],
};

const colors = ['#00cce8', '#f3ce08', '#cf24db', '#39ce25', '#f62739', '#1679f8',
  '#48d824', '#ff8818', '#a438ef', '#37c72d', '#2186fa'];

let column = 0;
const letters = [...word].map((letter, index) => {
  const glyph = glyphs[letter];
  const width = glyph[0].length;
  const cells = glyph.flatMap((line, row) => [...line].flatMap((mark, offset) => mark === '#'
    ? [{ row, x: padX + (column + offset) * block, y: padY + row * block }]
    : []));
  column += width + 1;
  return { color: colors[index], cells, end: padX + (column - 1) * block };
});
const artWidth = 2 * padX + (column - 1) * block;
const artHeight = 2 * padY + rows * block;

function tint(color, amount) {
  return '#' + color.slice(1).match(/../g).map(component => {
    const channel = Number.parseInt(component, 16);
    const target = amount < 0 ? 0 : 255;
    return Math.round(channel + (target - channel) * Math.abs(amount)).toString(16).padStart(2, '0');
  }).join('');
}

function square(x, y, size, fill) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${fill}"/>`;
}

function beveledCell({ x, y }, color) {
  return `<g data-logo-cell="" transform="translate(${x} ${y})">
${square(0, 0, block, tint(color, -.56))}
<path fill="${tint(color, .29)}" d="M1 1H15L12 4H4V12L1 15Z"/>
<path fill="${tint(color, -.33)}" d="M15 1V15H1L4 12H12V4Z"/>
<path fill="${color}" d="M3 3H13V13H3Z"/>
<path fill="${tint(color, .79)}" d="M2 2H9V3H4V4H3V6H2Z"/>
</g>`;
}

function glow({ x, y }, color) {
  return `<g fill="${color}">
<path opacity=".19" d="M${x - 2} ${y - 2}h2v-2h16v2h2v20h-2v2h-16v-2h-2Z"/>
<path opacity=".42" d="M${x - 1} ${y + 1}h1v-3h16v3h1v14h-1v3h-16v-3h-1Z"/>
</g>`;
}

function crackedCell({ x, y }, color) {
  const mirror = (x - padX) / block % 2 === 1;
  const tiles = ['###.', '##.#', '#.##', '.###'];
  return [-1, 1].map(side => {
    const cells = tiles.flatMap((line, row) => [...line].flatMap((mark, tile) => {
      if (mark !== '#' || (tile < 3 - row) !== (side === -1)) return [];
      const shade = row === 1 || row === 2 ? .9 : .66;
      return [square(x + (mirror ? 3 - tile : tile) * pixel, y + row * pixel, pixel, tint(color, shade))];
    }));
    return `<g data-logo-shard="${side}" data-logo-drift="${mirror ? -1 : 1}">${cells.join('')}</g>`;
  }).join('\n');
}

function sparks(x, color, direction) {
  const center = padY + (middle + .5) * block;
  return [-1, 1].map(side => {
    const outerY = center + (side === -1 ? -10 : 8);
    const innerY = center + (side === -1 ? -6 : 2);
    return `<g data-logo-shard="${side}" data-logo-drift="${direction}">
${square(x + (direction === -1 ? -4 : 2), outerY, 2, tint(color, .38))}
${square(x - 2, innerY, pixel, tint(color, .72))}
</g>`;
  }).join('\n');
}

export function renderBlocksLogo() {
  const solid = keep => letters.flatMap(({ cells, color }) => cells.filter(keep)
    .map(cell => beveledCell(cell, color))).join('\n');
  const broken = draw => letters.flatMap(({ cells, color }) => cells.filter(cell => cell.row === middle)
    .map(cell => draw(cell, color))).join('\n');
  const gutters = [sparks(padX / 2, letters[0].color, -1), ...letters.map(({ end, color }, index) =>
    sparks(end + block / 2, color, index < letters.length / 2 ? -1 : 1))].join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${artWidth}" height="${artHeight}" viewBox="0 0 ${artWidth} ${artHeight}" role="img" aria-label="Linebreaker" data-logo-block="${block}">
<title>Linebreaker</title>
<g data-logo-glow="" opacity=".7">${broken(glow)}</g>
<g data-logo-top="">${solid(cell => cell.row < middle)}</g>
<g data-logo-base="">${solid(cell => cell.row > middle)}</g>
<g data-logo-restored="" opacity="0">${solid(cell => cell.row === middle)}</g>
<g shape-rendering="crispEdges">${broken(crackedCell)}\n${gutters}</g>
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

  const demo = args.indexOf('--demo');
  if (demo !== -1) {
    if (!args[demo + 1]) throw new Error('--demo requires an output HTML path');
    const svgUrl = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const animation = readFileSync(new URL('logo-anim.js', root), 'utf8');
    const template = readFileSync(new URL('blocks-demo.html', import.meta.url), 'utf8');
    const parts = { BLOCKS_URL: svgUrl(blocks), STORE_URL: svgUrl(store), BLOCKS: blocks, ANIMATION: animation };
    writeFileSync(args[demo + 1], template.replace(/\{\{(\w+)\}\}/g, (_, name) => parts[name]));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeOutputs(process.argv.slice(2));
}
