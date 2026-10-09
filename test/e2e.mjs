// Uses the app in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
// Skeleton from the junkdrawer skill: the checks at the bottom are the ones every project wants;
// add the ones that prove this app does its job.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push(e.message));
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('requestfailed', r => problems.push('failed: ' + r.url()));
page.on('request', r => { if (!r.url().startsWith(base)) problems.push('left the site: ' + r.url()); });

await page.goto(base);
await page.evaluate(() => document.fonts.ready);

const text = sel => page.locator(sel).innerText();
const shown = sel => page.locator(sel).evaluate(el => !el.hidden);

// First visit: the welcome card, then the bridge at Earth.
await page.waitForFunction(() => window.engage);
assert.ok(await shown('#intro'), 'no welcome card on a first visit');
await page.click('#intro-go');
assert.equal(await shown('#intro'), false);
assert.equal(await text('#where'), 'Earth orbit');
assert.ok(await page.locator('#engage').isDisabled(), 'engage works with no destination');

// Tapping a star chooses it.
await page.evaluate(() => engage.lookAtStar('Sirius'));
await page.waitForTimeout(400);
const box = await page.locator('#labels').boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(200);
assert.equal(await text('#target-name'), 'Sirius', 'tapping a star did not choose it');

// Picking from the list, and searching.
await page.click('#choose');
await page.fill('#search', 'proxima');
await page.locator('#list .row').first().click();
assert.equal(await text('#target-name'), 'Proxima Centauri');
assert.match(await text('#trip'), /4\.2\d ly away/);

// Warp 9 to Proxima, flown fast, ends in a log entry.
await page.evaluate(() => engage.speed(8));
await page.click('#engage');
await page.waitForFunction(() => !document.getElementById('arrival').hidden, null, { timeout: 20000 });
const entry = await text('#arrival-entry');
assert.match(entry, /Proxima b’s orbit/);
assert.match(entry, /Cassiopeia/, 'the log does not say where the Sun is');
assert.match(entry, /in 1 day at warp 9/);
assert.match(entry, /Proxima b: Class M candidate/, 'the log does not link to the planetary survey');
assert.equal(await text('#where'), 'Proxima Centauri');

// Looking for the Sun turns the view toward it.
await page.click('#arrival-home');
await page.waitForTimeout(1800);
const sun = await page.evaluate(() => { const s = engage.state; return [s.yaw, s.pitch]; });
assert.ok(Math.abs(sun[1] - 60.8 * Math.PI / 180) < 0.1, 'the view did not turn toward the Sun');

// The log keeps the trip, and so does a reload.
await page.click('#open-log');
assert.match(await text('#stats'), /1 star visited · 4\.2\d ly traveled/);
await page.reload();
await page.waitForFunction(() => window.engage);
assert.equal(await text('#where'), 'Proxima Centauri', 'the ship forgot where it was');
assert.equal(await shown('#intro'), false);

// Fits a phone: nothing scrolls sideways.
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// If the graphics reset mid-flight, the viewscreen comes back instead of staying blank.
const brightness = async () => {
  const png = (await page.screenshot({ clip: { x: 20, y: 160, width: 350, height: 200 } })).toString('base64');
  return page.evaluate(async src => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4) / 3;
  }, png);
};
const loseGraphics = () => page.evaluate(() => { window.__gl = document.getElementById('sky').getContext('webgl').getExtension('WEBGL_lose_context'); __gl.loseContext(); });
await page.evaluate(() => { engage.speed(4); engage.target('Wolf 359'); });
await page.click('#engage');
await page.waitForTimeout(1500);
await loseGraphics();
await page.waitForTimeout(300);
await page.evaluate(() => __gl.restoreContext());
await page.waitForFunction(() => !document.getElementById('arrival').hidden, null, { timeout: 20000 });
await page.evaluate(() => engage.closeSheets());
await page.waitForTimeout(300);
assert.equal(await text('#where'), 'Wolf 359');
assert.ok(await brightness() < 40, 'the viewscreen stayed blank after the graphics came back');
assert.equal(await shown('#lost'), false);

// If they never come back, it offers a restart.
await loseGraphics();
await page.waitForTimeout(3000);
assert.ok(await shown('#lost'), 'no way out of a blank viewscreen');
await Promise.all([page.waitForNavigation(), page.click('#lost-reload')]);
await page.waitForFunction(() => window.engage);
assert.equal(await text('#where'), 'Wolf 359');
assert.equal(await shown('#lost'), false);

// The planetary survey: flip through the files, set course from one, and play the drill.
await page.goto(base + 'survey.html#K');
await page.waitForFunction(() => window.survey);
assert.match(await text('#file h2'), /Class K/);
await page.click('#next');
assert.match(await text('#file h2'), /Class H/);
assert.equal(new URL(page.url()).hash, '#H');
await page.locator('#strip .chip').nth(0).click();
assert.match(await text('#file h2'), /Class M/);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the survey scrolls sideways on a phone');
await page.waitForTimeout(1500); // the sharp map paints in the background
const lit = await page.evaluate(() => {
  const c = document.getElementById('globe'), g = c.getContext('2d');
  const d = g.getImageData(c.width * 0.35, c.height * 0.35, c.width * 0.3, c.height * 0.3).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4) / 3;
});
assert.ok(lit > 40, 'the planet is not drawn');
await Promise.all([page.waitForNavigation(), page.locator('#file .fly').first().click()]);
await page.waitForFunction(() => window.engage);
assert.equal(await text('#target-name'), 'Proxima Centauri', 'set course did not choose the star');
assert.equal(new URL(page.url()).search, '', 'the course link stayed in the address');

await page.goto(base + 'survey.html#drill');
await page.waitForFunction(() => window.survey?.world);
let world = await page.evaluate(() => survey.world.cls.id);
await page.click(`#choices [data-id="${world}"]`);
assert.match(await text('#verdict-head'), /Record filed/);
assert.match(await text('#score'), /streak 1/i);
await page.click('#drill-next');
world = await page.evaluate(() => survey.world.cls.id);
const wrong = await page.evaluate(() => survey.world.choices.find(c => c.id !== survey.world.cls.id).id);
await page.click(`#choices [data-id="${wrong}"]`);
assert.match(await text('#verdict-head'), /wouldn’t fool anyone/);
assert.match(await text('#score'), /streak 0 · best 1/i);
await page.click('#verdict-file');
assert.equal(await shown('#files'), true, 'reading the file did not open it');
assert.equal(await page.evaluate(() => location.hash.slice(1)), world);
// The Kobayashi Maru: reached from the bridge, played to the end, graded and remembered.
await page.goto(base);
await page.waitForFunction(() => window.engage);
await Promise.all([page.waitForNavigation(), page.click('#open-maru')]);
await page.waitForFunction(() => window.maru);
assert.equal(await shown('#brief'), true);
assert.equal(await shown('#rewrite'), false, 'the simulator can be reprogrammed before taking the test');
await page.click('#start');
const order = async id => {
  await page.click(`.order[data-id="${id}"]`);
  await page.waitForFunction(() => !maru.busy, null, { timeout: 20000 });
};
await order('hail-maru');
assert.match(await text('#comms'), /381 aboard/);
await order('enter');
assert.equal(await shown('#alert'), true, 'no red alert when the Klingons arrive');
assert.match(await text('#caption'), /Leave Klingon space/);
await order('beam');
assert.equal(await text('#rescued'), '75');
await order('beam');
await order('warp');
assert.equal(await page.locator('.order').count(), 0, 'orders still offered after the simulation ended');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the Kobayashi Maru scrolls sideways on a phone');
await page.click('#read-eval');
assert.equal(await text('#eval-title'), 'The lifeboat');
assert.equal(await page.locator('.grade').count(), 4);
await page.click('#again');
assert.match(await text('#runs'), /The lifeboat/);
assert.equal(await shown('#rewrite'), true, 'no way to reprogram the simulator after a run');
await page.click('#rewrite');
await order('enter');
for (let i = 0; i < 6; i++) await order('beam');
await order('warp');
await page.click('#read-eval');
assert.equal(await text('#eval-title'), 'Changed the rules');
await page.goto(base);
await page.waitForFunction(() => window.engage);

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
assert.ok(await page.title(), 'the page did not load offline');
await ctx.setOffline(false);

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
await browser.close();
server.close();
console.log('all good');
