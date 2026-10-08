// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
// Math.random is seeded, so the warp streaks come out the same each time.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.bin': 'application/octet-stream' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const SEED = 4;
// Headless Chromium draws WebGL in software.
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir(join(root, 'docs'), { recursive: true });

async function open(viewport, deviceScaleFactor) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(seed => {
    let a = seed; // mulberry32
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    localStorage.setItem('engage.v1', JSON.stringify({ seenIntro: true }));
  }, SEED);
  await page.goto(base);
  await page.waitForFunction(() => window.engage);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// Phone screenshots for the README.
{
  const page = await open({ width: 390, height: 844 }, 2);
  await page.evaluate(() => engage.target('Proxima Centauri'));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: join(root, 'docs/phone-helm.png') });

  await page.evaluate(() => engage.freeze('Proxima Centauri', 0.42));
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(root, 'docs/phone-warp.png') });

  await page.reload();
  await page.waitForFunction(() => window.engage);
  await page.evaluate(() => { engage.speed(10); engage.target('Proxima Centauri'); });
  await page.click('#engage');
  await page.waitForFunction(() => !document.getElementById('arrival').hidden, null, { timeout: 20000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(root, 'docs/phone-log.png') });

  await page.click('#arrival-home');
  await page.waitForTimeout(4200);
  await page.screenshot({ path: join(root, 'docs/phone-home.png') });
  await page.context().close();
}

// Link preview, 1200 x 630: a card with the name on the left and the viewscreen at warp on the right.
{
  const page = await open({ width: 640, height: 630 }, 1);
  await page.evaluate(() => { engage.state.opts.labels = false; engage.freeze('Rigil Kentaurus', 0.36); });
  await page.waitForTimeout(700);
  const shot = await page.evaluate(() => document.getElementById('sky').toDataURL('image/png'));
  await page.context().close();

  const font = async f => (await readFile(join(root, 'fonts', f))).toString('base64');
  const card = await open({ width: 1200, height: 630 }, 1);
  await card.setContent(`<!doctype html><style>
    @font-face { font-family: C; font-weight: 600; src: url(data:font/woff2;base64,${await font('chakra-petch-600.woff2')}); }
    @font-face { font-family: P; src: url(data:font/woff2;base64,${await font('ibm-plex-sans.woff2')}); }
    body { margin: 0; width: 1200px; height: 630px; background: #05070d; color: #e8edf6; display: flex; overflow: hidden; }
    .text { width: 560px; padding: 0 0 0 72px; display: flex; flex-direction: column; justify-content: center; position: relative; z-index: 1; }
    .eyebrow { font: 600 22px C; letter-spacing: .18em; text-transform: uppercase; color: #ffb54a; }
    h1 { margin: 10px 0 18px; font: 600 104px/1 C; letter-spacing: .1em; text-transform: uppercase; }
    p { margin: 0; font: 34px/1.3 P; color: #cdd5e3; max-width: 440px; }
    .meta { margin-top: 30px; font: 600 22px C; letter-spacing: .08em; color: #86d8ff; }
    .view { position: absolute; right: 0; top: 0; width: 640px; height: 630px; background: url(${shot}) center / cover; }
    .view::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #05070d 0%, rgba(5,7,13,0) 30%); }
  </style>
  <div class="text"><div class="eyebrow">Warp 9 · real stars</div><h1>Engage</h1><p>Set course for a real star, pick a warp factor and go.</p><div class="meta">18,000 stars, each in its real place</div></div>
  <div class="view"></div>`);
  await card.waitForTimeout(300);
  await card.screenshot({ path: join(root, 'og.png') });
  await card.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
