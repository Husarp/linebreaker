import { readFile, readdir, writeFile } from 'node:fs/promises';

const conceptsDir = new URL('../design/skins-ai/', import.meta.url);
const prompts = JSON.parse(await readFile(new URL('prompts.json', conceptsDir), 'utf8'));
const files = await readdir(conceptsDir, { withFileTypes: true });
const concepts = files.filter(file => file.isFile() && /\.png$/i.test(file.name))
    .map(file => file.name).sort().map(file => {
        const key = file.replace(/\.png$/i, '');
        return {
            key,
            name: key.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            src: `../design/skins-ai/${encodeURIComponent(file)}`,
            prompt: prompts[key] ?? null,
        };
    });
await writeFile(new URL('skins-ai.json', import.meta.url), `${JSON.stringify(concepts, null, 2)}\n`);
console.log(`Wrote ${concepts.length} concepts to tools/skins-ai.json`);
