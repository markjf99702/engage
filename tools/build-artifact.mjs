// Bundles the whole app into one HTML file for the Artifact viewer:  node tools/build-artifact.mjs
// Writes dist/engage.html, dist/survey.html and dist/maru.html: styles, fonts, scripts, star data and the Milky Way all inline, with no document wrapper
// (the viewer adds its own). The site itself still runs from the repo as-is; this is only for the playable copy.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f, enc = 'utf8') => readFile(join(root, f), enc);
const b64 = async f => (await readFile(join(root, f))).toString('base64');

const LIVE = 'https://junkdrawer.works/engage/';
const html = await read('index.html');
let css = await read('css/app.css');
for (const [, file] of css.matchAll(/url\(\.\.\/fonts\/([^)]+)\)/g)) {
  css = css.replace(`url(../fonts/${file})`, `url(data:font/woff2;base64,${await b64(`fonts/${file}`)})`);
}

// Each module becomes a function that returns its exports; imports read from those.
async function bundle(order, patch = (name, src) => src) {
  let js = '';
  for (const name of order) {
    let src = await read(`js/${name}.js`);
    src = src.replace(/^import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([\w-]+)\.js';\s*$/gm,
      (_, names, mod) => `const {${names.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2')}} = __m[${JSON.stringify(mod)}];`);
    const exported = [];
    src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kind, id) => { exported.push(id); return `${kind} ${id}`; });
    src = src.replace(/^\s*if \('serviceWorker' in navigator.*$/m, '');
    src = await patch(name, src);
    js += `__m[${JSON.stringify(name)}] = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
  }
  return js;
}
const pageBody = page => page.slice(page.indexOf('<body') , page.indexOf('</body>')).replace(/^<body[^>]*>/, '').replace(/<script type="module" src="[^"]+"><\/script>/, '');

const ORDER = ['physics', 'destinations', 'classes', 'audio', 'log', 'catalog', 'sky', 'app'];
const js = await bundle(ORDER, async (name, src) => {
  if (name !== 'app') return src;
  return src
    .replace("img.src = 'img/milkyway.png';", `img.src = 'data:image/png;base64,${await b64('img/milkyway.png')}';`)
    .replace("const SURVEY = 'survey.html';", `const SURVEY = '${LIVE}survey.html';`);
});
const data = {
  'data/stars.bin': await b64('data/stars.bin'),
  'data/stars.json': await read('data/stars.json'),
};
const shim = `
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
const body = pageBody(html).replaceAll('href="survey.html"', `href="${LIVE}survey.html" target="_blank" rel="noopener"`)
  .replaceAll('href="maru.html"', `href="${LIVE}maru.html" target="_blank" rel="noopener"`);
const out = `${title}
<meta name="theme-color" content="#05070d">
<style>
${css}
</style>
${body}
<script type="module">
const __m = {};
${shim}
${js}
</script>
`;
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/engage.html'), out);
console.log(`dist/engage.html: ${(out.length / 1024 / 1024).toFixed(2)} MB`);

// The planetary survey, as its own single file. Links back to the bridge go to the live site.
const surveyHtml = await read('survey.html');
const surveyJs = await bundle(['classes', 'planet-art', 'survey'], (name, src) =>
  src.replace("const BRIDGE = './';", `const BRIDGE = '${LIVE}';`));
const surveyCss = css + '\n' + await read('css/survey.css');
const surveyOut = `<title>Planetary survey</title>
<meta name="theme-color" content="#05070d">
<style>
${surveyCss}
</style>
<div class="survey-root">
${pageBody(surveyHtml).replaceAll('href="./"', `href="${LIVE}" target="_blank" rel="noopener"`)}
</div>
<script type="module">
const __m = {};
document.body.classList.add('survey');
${surveyJs}
</script>
`;
await writeFile(join(root, 'dist/survey.html'), surveyOut);
console.log(`dist/survey.html: ${(surveyOut.length / 1024).toFixed(0)} KB`);

// The Kobayashi Maru, as its own single file. Links back to the bridge go to the live site.
const maruHtml = await read('maru.html');
const maruJs = await bundle(['audio', 'maru-sim', 'maru']);
const maruOut = `<title>Kobayashi Maru</title>
<meta name="theme-color" content="#05070d">
<style>
${css}
${await read('css/maru.css')}
</style>
<div class="maru-root">
${pageBody(maruHtml).replaceAll('href="./"', `href="${LIVE}" target="_blank" rel="noopener"`)}
</div>
<script type="module">
const __m = {};
document.body.classList.add('maru');
${maruJs}
</script>
`;
await writeFile(join(root, 'dist/maru.html'), maruOut);
console.log(`dist/maru.html: ${(maruOut.length / 1024).toFixed(0)} KB`);
