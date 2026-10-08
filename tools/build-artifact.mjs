// Bundles the whole app into one HTML file for the Artifact viewer:  node tools/build-artifact.mjs
// Writes dist/engage.html: styles, fonts, scripts, star data and the Milky Way all inline, with no document wrapper
// (the viewer adds its own). The site itself still runs from the repo as-is; this is only for the playable copy.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f, enc = 'utf8') => readFile(join(root, f), enc);
const b64 = async f => (await readFile(join(root, f))).toString('base64');

const html = await read('index.html');
let css = await read('css/app.css');
for (const [, file] of css.matchAll(/url\(\.\.\/fonts\/([^)]+)\)/g)) {
  css = css.replace(`url(../fonts/${file})`, `url(data:font/woff2;base64,${await b64(`fonts/${file}`)})`);
}

// Each module becomes a function that returns its exports; imports read from those.
const ORDER = ['physics', 'destinations', 'audio', 'log', 'catalog', 'sky', 'app'];
let js = '';
for (const name of ORDER) {
  let src = await read(`js/${name}.js`);
  src = src.replace(/^import\s*\{([\s\S]*?)\}\s*from\s*'\.\/(\w+)\.js';\s*$/gm,
    (_, names, mod) => `const {${names.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2')}} = __m.${mod};`);
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kind, id) => { exported.push(id); return `${kind} ${id}`; });
  if (name === 'app') {
    src = src.replace("img.src = 'img/milkyway.png';", `img.src = 'data:image/png;base64,${await b64('img/milkyway.png')}';`);
    src = src.replace(/^\s*if \('serviceWorker' in navigator.*$/m, '');
  }
  js += `__m.${name} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}
const data = {
  'data/stars.bin': await b64('data/stars.bin'),
  'data/stars.json': await read('data/stars.json'),
};
const shim = `const __m = {};
const __data = { bin: '${data['data/stars.bin']}', json: ${JSON.stringify(data['data/stars.json'])} };
window.fetch = async url => {
  if (String(url).endsWith('stars.bin')) {
    const raw = atob(__data.bin), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return { arrayBuffer: async () => bytes.buffer };
  }
  if (String(url).endsWith('stars.json')) return { json: async () => JSON.parse(__data.json) };
  throw new Error('not bundled: ' + url);
};
`;

const title = html.match(/<title>.*?<\/title>/)[0];
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script type="module" src="js\/app\.js"><\/script>/, '');
const out = `${title}
<meta name="theme-color" content="#05070d">
<style>
${css}
</style>
${body}
<script type="module">
${shim}
${js}
</script>
`;
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/engage.html'), out);
console.log(`dist/engage.html: ${(out.length / 1024 / 1024).toFixed(2)} MB`);
