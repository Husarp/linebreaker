import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';

export const webViewTarget = 'chrome60';

export function compileScript(source, filename) {
  const options = { sourcefile: filename, legalComments: 'inline' };
  const { code, warnings } = transformSync(source, { ...options, target: webViewTarget });
  const modern = transformSync(source, { ...options, target: 'esnext' }).code;
  if (warnings.length) throw new Error(`${filename}: ${warnings.map(warning => warning.text).join('; ')}`);
  const regexConstructors = output => (output.match(/\bnew RegExp\(/g) || []).length;
  if (regexConstructors(code) > regexConstructors(modern)) throw new Error(`${filename}: regular expression syntax is unavailable on ${webViewTarget}`);
  return code === modern ? source : code;
}

export async function checkWebView(root, { compile = false } = {}) {
  const entry = path.join(root, 'index.html');
  let html = await readFile(entry, 'utf8');
  const dom = new JSDOM(html, { includeNodeLocations: true, url: 'https://localhost/' });
  const changes = [];
  const check = (source, name, canCompile = false) => {
    const output = compileScript(source, name);
    if (output !== source && !canCompile) throw new Error(`${name} must run as written on ${webViewTarget}`);
    return output;
  };
  try {
    for (const script of dom.window.document.scripts) {
      const type = script.getAttribute('type');
      if (type && !/^(module|(?:text|application)\/(?:java|ecma)script)$/i.test(type)) continue;
      if (script.hasAttribute('src')) {
        const url = new URL(script.src);
        if (url.origin !== 'https://localhost') throw new Error(`Startup script must be local: ${script.src}`);
        const name = url.pathname.slice(1);
        const file = path.join(root, name);
        const source = await readFile(file, 'utf8');
        const output = check(source, name, compile && !['boot.js', 'compat.js'].includes(name));
        if (output !== source) await writeFile(file, output);
      } else {
        const { startTag, endTag, startLine } = dom.nodeLocation(script);
        const output = check(script.textContent, `index.html:${startLine}`, compile);
        if (output !== script.textContent) changes.push([startTag.endOffset, endTag.startOffset, output]);
      }
    }
    for (const element of dom.window.document.querySelectorAll('*')) {
      for (const attr of element.attributes) {
        if (!attr.name.startsWith('on')) continue;
        const { startLine } = dom.nodeLocation(element).attrs[attr.name];
        check(`function handler(event) {\n${attr.value}\n}`, `index.html:${startLine} ${attr.name}`);
      }
    }
  } finally { dom.window.close(); }
  if (changes.length) {
    for (const [start, end, output] of changes.reverse()) html = html.slice(0, start) + output.replace(/<\/script/gi, '<\\/script') + html.slice(end);
    await writeFile(entry, html);
  }
}
