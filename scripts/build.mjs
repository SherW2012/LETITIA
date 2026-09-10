import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';

const root = resolve('dist');
const assets = {};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'server' || entry.name.startsWith('.')) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (types[extname(path)]) assets['/' + relative(root, path).split('\\').join('/')] = { body: await readFile(path, 'utf8'), type: types[extname(path)] };
  }
}
await collect(root);
const source = await readFile('worker/index.js', 'utf8');
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js', 'const SITE_ASSETS = ' + JSON.stringify(assets) + ';\n' + source);
await writeFile('dist/.openai/hosting.json', await readFile('.openai/hosting.json'));
console.log(`Built Worker with ${Object.keys(assets).length} bundled assets; no external dependencies.`);
