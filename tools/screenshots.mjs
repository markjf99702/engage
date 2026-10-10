// Renders the README screenshots (docs/*.png) and the link previews (og.png, og-survey.png, og-maru.png, og-missions.png):  node tools/screenshots.mjs
// Only the planetary survey's, the Kobayashi Maru's or long missions':  node tools/screenshots.mjs survey  (or maru, or missions)
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
const only = process.argv[2];
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
if (!only) {
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
if (!only) {
  const page = await open({ width: 640, height: 630 }, 1);
  await page.evaluate(() => { engage.state.opts.labels = false; engage.freeze('Rigil Kentaurus', 0.36); });
  await page.waitForTimeout(700);
  const shot = await page.evaluate(() => engage.snapshot());
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

// The planetary survey: a phone screenshot for the README, and its link preview with a row of planets.
if (!only || only === 'survey') {
  const page = await open({ width: 390, height: 844 }, 2);
  await page.goto(base + 'survey.html#O');
  await page.waitForFunction(() => window.survey);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(root, 'docs/phone-survey.png') });
  const planets = await page.evaluate(async () => {
    const { paint, portrait } = await import('./js/planet-art.js');
    return [['earth', 3], ['jovian', 1], ['lava', 1], ['icegiant', 4], ['mars', 1]].map(([s, seed]) => portrait(paint(s, seed, 512), 520, 0.9).toDataURL());
  });
  await page.context().close();

  const font = async f => (await readFile(join(root, 'fonts', f))).toString('base64');
  const card = await open({ width: 1200, height: 630 }, 1);
  await card.setContent(`<!doctype html><style>
    @font-face { font-family: C; font-weight: 600; src: url(data:font/woff2;base64,${await font('chakra-petch-600.woff2')}); }
    @font-face { font-family: P; src: url(data:font/woff2;base64,${await font('ibm-plex-sans.woff2')}); }
    body { margin: 0; width: 1200px; height: 630px; background: radial-gradient(ellipse at 75% 50%, #111b33, #05070d 70%); color: #e8edf6; overflow: hidden; position: relative; }
    .text { position: absolute; left: 72px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; z-index: 1; }
    .eyebrow { font: 600 22px C; letter-spacing: .18em; text-transform: uppercase; color: #ffb54a; }
    h1 { margin: 10px 0 18px; font: 600 80px/1 C; letter-spacing: .04em; }
    p { margin: 0; font: 32px/1.3 P; color: #cdd5e3; max-width: 470px; }
    .meta { margin-top: 30px; font: 600 22px C; letter-spacing: .08em; color: #86d8ff; }
    img { position: absolute; }
  </style>
  <div class="text"><div class="eyebrow">Engage · Science station</div><h1>Planetary survey</h1><p>Starfleet’s planet classes, next to the real planets astronomers have found.</p><div class="meta">From Class M to Demon class</div></div>
  <img src="${planets[1]}" style="left:690px; top:-40px; width:420px">
  <img src="${planets[0]}" style="left:610px; top:270px; width:330px">
  <img src="${planets[2]}" style="left:930px; top:330px; width:260px">
  <img src="${planets[3]}" style="left:1050px; top:110px; width:200px">
  <img src="${planets[4]}" style="left:560px; top:120px; width:150px">`);
  await card.waitForTimeout(300);
  await card.screenshot({ path: join(root, 'og-survey.png') });
  await card.context().close();
}

// The Kobayashi Maru: a phone screenshot mid-battle for the README, and its link preview with the tactical display.
if (!only || only === 'maru') {
  const play = async (page, plan) => {
    for (const id of plan) {
      await page.click(`.order[data-id="${id}"]`);
      await page.waitForFunction(() => !maru.busy, null, { timeout: 20000 });
    }
  };
  const page = await open({ width: 390, height: 844 }, 2);
  await page.goto(base + 'maru.html');
  await page.waitForFunction(() => window.maru);
  await page.click('#start');
  await play(page, ['hail-maru', 'enter', 'beam', 'beam']);
  await page.click('.order[data-id="phasers"]');
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(root, 'docs/phone-maru.png') });
  await page.context().close();

  const wide = await open({ width: 700, height: 900 }, 1);
  await wide.goto(base + 'maru.html');
  await wide.waitForFunction(() => window.maru);
  await wide.click('#start');
  await play(wide, ['enter', 'beam', 'torpedoes']);
  await wide.waitForTimeout(400);
  const shot = await wide.evaluate(() => document.getElementById('plot').toDataURL());
  await wide.context().close();

  const font = async f => (await readFile(join(root, 'fonts', f))).toString('base64');
  const card = await open({ width: 1200, height: 630 }, 1);
  await card.setContent(`<!doctype html><style>
    @font-face { font-family: C; font-weight: 600; src: url(data:font/woff2;base64,${await font('chakra-petch-600.woff2')}); }
    @font-face { font-family: P; src: url(data:font/woff2;base64,${await font('ibm-plex-sans.woff2')}); }
    body { margin: 0; width: 1200px; height: 630px; background: radial-gradient(ellipse at 20% 0%, #3a0f14, #05070d 65%); color: #e8edf6; overflow: hidden; position: relative; }
    .text { position: absolute; left: 72px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; z-index: 1; }
    .eyebrow { font: 600 22px C; letter-spacing: .18em; text-transform: uppercase; color: #ff6b5e; }
    h1 { margin: 10px 0 18px; font: 600 80px/1 C; letter-spacing: .03em; }
    p { margin: 0; font: 32px/1.3 P; color: #cdd5e3; max-width: 470px; }
    .meta { margin-top: 30px; font: 600 22px C; letter-spacing: .08em; color: #ffb54a; }
    .view { position: absolute; right: 0; top: 0; width: 640px; height: 630px; background: url(${shot}) 70% center / cover; }
    .view::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #05070d 0%, rgba(5,7,13,0) 35%); }
  </style>
  <div class="view"></div>
  <div class="text"><div class="eyebrow">Starfleet Academy</div><h1>Kobayashi Maru</h1><p>The no-win test. You can’t save everyone, so you’re graded on how you lose.</p><div class="meta">One order a turn</div></div>`);
  await card.waitForTimeout(300);
  await card.screenshot({ path: join(root, 'og-maru.png') });
  await card.context().close();
}

// Long missions: a phone screenshot of the map for the README, and its link preview with the map beside the words.
if (!only || only === 'missions') {
  const page = await open({ width: 390, height: 844 }, 2);
  await page.goto(base + 'missions.html#v1');
  await page.waitForFunction(() => window.missions);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(root, 'docs/phone-missions.png') });
  await page.context().close();

  const wide = await open({ width: 640, height: 700 }, 1);
  await wide.goto(base + 'missions.html#v1');
  await wide.waitForFunction(() => window.missions);
  await wide.evaluate(() => document.fonts.ready);
  await wide.waitForTimeout(600);
  const shot = await wide.evaluate(() => document.getElementById('map').toDataURL());
  await wide.context().close();

  const font = async f => (await readFile(join(root, 'fonts', f))).toString('base64');
  const card = await open({ width: 1200, height: 630 }, 1);
  await card.setContent(`<!doctype html><style>
    @font-face { font-family: C; font-weight: 600; src: url(data:font/woff2;base64,${await font('chakra-petch-600.woff2')}); }
    @font-face { font-family: P; src: url(data:font/woff2;base64,${await font('ibm-plex-sans.woff2')}); }
    body { margin: 0; width: 1200px; height: 630px; background: radial-gradient(ellipse at 20% 0%, #13213d, #05070d 65%); color: #e8edf6; overflow: hidden; position: relative; }
    .text { position: absolute; left: 72px; top: 0; bottom: 0; width: 540px; display: flex; flex-direction: column; justify-content: center; z-index: 1; }
    .eyebrow { font: 600 22px C; letter-spacing: .18em; text-transform: uppercase; color: #86d8ff; }
    h1 { margin: 10px 0 18px; font: 600 80px/1 C; letter-spacing: .03em; }
    p { margin: 0; font: 32px/1.3 P; color: #cdd5e3; max-width: 500px; }
    .meta { margin-top: 30px; font: 600 22px C; letter-spacing: .08em; color: #ffb54a; }
    .view { position: absolute; right: -10px; top: -30px; width: 640px; height: 700px; background: url(${shot}) center / contain no-repeat; }
  </style>
  <div class="view"></div>
  <div class="text"><div class="eyebrow">Engage · Long-range sensors</div><h1>Long missions</h1><p>The Voyagers, New Horizons, Webb and the Pioneers, where they are right now.</p><div class="meta">From NASA’s own trajectories</div></div>`);
  await card.waitForTimeout(300);
  await card.screenshot({ path: join(root, 'og-missions.png') });
  await card.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
