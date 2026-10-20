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
// The bridge is ready once its hooks are there. window.engage on its own is no sign: before the app starts, the
// browser hands back the Engage button under that name, because of its id.
const bridgeReady = (p = page) => p.waitForFunction(() => typeof window.engage?.jump === 'function', null, { timeout: 30000 });

// First visit: the welcome card, then the bridge at Earth.
await bridgeReady();
assert.ok(await shown('#intro'), 'no welcome card on a first visit');
await page.click('#intro-go');
assert.equal(await shown('#intro'), false);
assert.equal(await text('#where'), 'Earth orbit');
assert.ok(await page.locator('#engage').isDisabled(), 'engage works with no destination');

// On a small phone, or any phone turned on its side, the welcome card is taller than the screen, so it scrolls and
// Take the helm can still be reached.
for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  const small = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await small.newPage();
  p.on('pageerror', e => problems.push(e.message));
  await p.goto(base);
  await bridgeReady(p);
  const touch = await small.newCDPSession(p);
  const x = viewport.width / 2, from = viewport.height - 40, to = 40;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
  for (let i = 1; i <= 10; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from + (to - from) * i / 10 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(600);
  const go = await p.locator('#intro-go').boundingBox();
  assert.ok(go.y + go.height <= viewport.height, `Take the helm is below the bottom of a ${viewport.width}×${viewport.height} screen`);
  await p.touchscreen.tap(go.x + go.width / 2, go.y + go.height / 2);
  assert.equal(await p.locator('#intro').evaluate(el => el.hidden), true, `the welcome card stayed up on a ${viewport.width}×${viewport.height} screen`);
  await small.close();
}

// With a keyboard: the welcome card takes focus and Escape puts it away, Set course takes the search field, and a
// sheet gives focus back to the button that opened it when it closes. Tonight's sheets do the same.
{
  const keys = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await keys.newPage();
  p.on('pageerror', e => problems.push(e.message));
  const focused = () => p.evaluate(() => document.activeElement?.id || document.activeElement?.closest('.sheet')?.id + ' ' + document.activeElement?.className);
  await p.goto(base);
  await bridgeReady(p);
  assert.equal(await focused(), 'intro-go', 'the welcome card did not take focus');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#intro').evaluate(el => el.hidden), true, 'Escape did not put the welcome card away');
  await p.focus('#choose');
  await p.keyboard.press('Enter');
  assert.equal(await focused(), 'search', 'Set course did not focus the search field');
  await p.keyboard.type('vega');
  assert.match(await p.locator('#list .row').first().innerText(), /^Vega/);
  await p.keyboard.press('Escape');
  assert.equal(await focused(), 'choose', 'closing Set course did not give focus back to the destination');
  await p.focus('#open-settings');
  await p.keyboard.press('Enter');
  assert.equal(await focused(), 'settings close', 'Bridge settings did not take focus');
  await p.keyboard.press('Escape');
  assert.equal(await focused(), 'open-settings');
  await p.goto(base + 'tonight.html');
  await p.waitForFunction(() => window.tonight);
  await p.focus('#open-list');
  await p.keyboard.press('Enter');
  assert.equal(await focused(), 'list close', 'tonight’s list did not take focus');
  await p.keyboard.press('Escape');
  assert.equal(await focused(), 'open-list');
  await keys.close();
  // On a touchscreen, Set course focuses its close button, so the phone's keyboard doesn't come up over the list.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const q = await phone.newPage();
  await q.goto(base);
  await bridgeReady(q);
  await q.tap('#intro-go');
  await q.tap('#choose');
  assert.equal(await q.evaluate(() => document.activeElement?.closest('.sheet')?.id + ' ' + document.activeElement?.className), 'picker close', 'Set course did not focus its close button on a phone');
  await phone.close();
}

// Tapping a star chooses it.
await page.evaluate(() => engage.lookAtStar('Sirius'));
await page.waitForTimeout(400);
const box = await page.locator('#labels').boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(200);
assert.equal(await text('#target-name'), 'Sirius', 'tapping a star did not choose it');

// Star names stay on the screen and off the header: around Sirius, seen from Earth on a phone, Alnilam and Rigel are at
// the right edge and Alhena under the buttons.
await page.waitForTimeout(200);
{
  const names = await page.evaluate(() => engage.labels());
  assert.ok(names.some(l => l.text === 'Alnilam'), `Alnilam is not named: ${names.map(l => l.text)}`);
  const hud = await page.evaluate(() => [...document.querySelectorAll('.hud .where, .hud-buttons')].map(el => el.getBoundingClientRect().toJSON()));
  for (const l of names) {
    assert.ok(l.x >= 0 && l.x + l.w <= 390 && l.y >= 12 && l.y <= 840, `${l.text} runs off the screen (${Math.round(l.x)} to ${Math.round(l.x + l.w)}, ${Math.round(l.y)} down)`);
    for (const b of hud) assert.ok(l.x > b.right || l.x + l.w < b.left || l.y - 12 > b.bottom || l.y + 4 < b.top, `${l.text} is under the header`);
  }
}

// Without JavaScript, the page says what it needs it for, in front of everything else.
{
  const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const p = await plain.newPage();
  for (const file of ['', 'tonight.html']) {
    await p.goto(base + file);
    const on = await p.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.className);
    assert.equal(on, 'noscript', `the no-JavaScript note is hidden behind the page on ${file || 'the bridge'}`);
  }
  await plain.close();
}

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
await bridgeReady();
assert.equal(await text('#where'), 'Proxima Centauri', 'the ship forgot where it was');
assert.equal(await shown('#intro'), false);

// Fits a phone: nothing scrolls sideways.
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// If the star charts can't be fetched, the bridge says so rather than charting forever.
{
  const cut = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await cut.route('**/data/stars.bin', r => r.abort());
  const p = await cut.newPage();
  await p.goto(base);
  const said = await p.waitForFunction(() => document.getElementById('loading').textContent.includes('Couldn’t chart the stars'), null, { timeout: 15000 }).then(() => true, () => false);
  assert.ok(said, 'the bridge kept charting after the star data failed to load');
  await cut.close();
}

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
await bridgeReady();
assert.equal(await text('#where'), 'Wolf 359');
assert.equal(await shown('#lost'), false);

// Clearing the log mid-flight takes the ship straight home: the flight ends there too.
await page.evaluate(() => { engage.speed(1); engage.target('Deneb'); });
await page.click('#engage');
await page.waitForFunction(() => engage.trip?.phase === 'cruise', null, { timeout: 20000 });
await page.click('#open-settings');
await page.click('#clear-log');
await page.click('#clear-log');
assert.equal(await page.evaluate(() => !!engage.trip), false, 'the ship flew on after the log was cleared');
assert.equal(await text('#where'), 'Earth orbit');
assert.equal(await shown('#readout'), false);
assert.equal(await page.evaluate(() => engage.state.log.length), 0);

// The planetary survey: flip through the files, set course from one, and play the drill.
await page.goto(base + 'survey.html#K');
await page.waitForFunction(() => window.survey);
assert.match(await text('#file h2'), /Class K/);
await page.click('#next');
assert.match(await text('#file h2'), /Class H/);
assert.equal(new URL(page.url()).hash, '#H');
await page.locator('#strip .chip').nth(0).click();
assert.match(await text('#file h2'), /Class M/);
assert.equal(await page.getByRole('button', { name: 'Class M: Earth-like' }).count(), 1, 'the thumbnails are not buttons to a screen reader');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the survey scrolls sideways on a phone');
await page.waitForTimeout(1500); // the sharp map paints in the background
const lit = await page.evaluate(() => {
  const c = document.getElementById('globe'), g = c.getContext('2d');
  const d = g.getImageData(c.width * 0.35, c.height * 0.35, c.width * 0.3, c.height * 0.3).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4) / 3;
});
assert.ok(lit > 40, 'the planet is not drawn');
// With reduced motion the globe stands still, so it isn't drawn again and again.
await page.emulateMedia({ reducedMotion: 'reduce' });
const redraws = await page.evaluate(() => new Promise(done => {
  const put = CanvasRenderingContext2D.prototype.putImageData;
  let n = 0;
  CanvasRenderingContext2D.prototype.putImageData = function (...a) { if (this.canvas.id === 'globe') n++; return put.apply(this, a); };
  setTimeout(() => { CanvasRenderingContext2D.prototype.putImageData = put; done(n); }, 1500);
}));
await page.emulateMedia({ reducedMotion: null });
assert.ok(redraws <= 1, `the globe was drawn ${redraws} times in 1.5 seconds without moving`);
await Promise.all([page.waitForNavigation(), page.locator('#file .fly').first().click()]);
await bridgeReady();
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
await bridgeReady();
await Promise.all([page.waitForNavigation(), page.click('#open-maru')]);
await page.waitForFunction(() => window.maru);
assert.equal(await shown('#brief'), true);
assert.deepEqual(await page.locator('.jd-foot a').allInnerTexts(), ['Part of junkdrawer.works', 'Privacy', 'Engage'], 'the footer’s own link comes before the drawer’s');
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
// Long missions: reached from the bridge, the ships on file, a hail sent, and a course set for where one is bound.
await page.goto(base);
await bridgeReady();
await Promise.all([page.waitForNavigation(), page.click('#open-missions')]);
await page.waitForFunction(() => window.missions);
assert.equal(await text('#ship-name'), 'Voyager 1');
assert.match(await text('#sun-km'), /^\d{2},\d{3},\d{3},\d{3} km$/);
assert.match(await text('#signal'), /\d+ h \d\d m \d\d s/);
assert.equal(await page.locator('.ship-tab').count(), 6);
await page.click('#hail');
assert.match(await text('#hail-note'), /of the way there/);
await page.locator('.ship-tab[data-id="jwst"]').click();
assert.equal(await page.evaluate(() => missions.view), 'earth', 'Webb did not open the near-Earth view');
assert.match(await text('#signal'), /seconds/);
await page.click('#view-sun');
assert.equal(await page.evaluate(() => missions.sel), 'v1');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'long missions scrolls sideways on a phone');
// The numbers tick over ten times a second, so they aren't in a part of the page that's read out as it changes.
const chatter = await page.evaluate(() => new Promise(done => {
  let changes = 0;
  const watch = new MutationObserver(list => { changes += list.length; });
  for (const el of document.querySelectorAll('[aria-live]:not([aria-live="off"])')) watch.observe(el, { subtree: true, childList: true, characterData: true });
  setTimeout(() => { watch.disconnect(); done(changes); }, 1000);
}));
assert.equal(chatter, 0, 'screen readers would read out the ticking numbers');
const mapLit = await page.evaluate(() => {
  const c = document.getElementById('map'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) n++;
  return n;
});
assert.ok(mapLit > 5000, 'the map is not drawn');
await page.locator('.ship-tab[data-id="v2"]').click();
await Promise.all([page.waitForNavigation(), page.click('#ship-course')]);
await bridgeReady();
assert.equal(await text('#target-name'), 'Ross 248', 'set course did not choose the star Voyager 2 is bound for');

// A damaged save keeps what's still good and starts the rest afresh, instead of stopping the page.
{
  const junk = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await junk.addInitScript(() => {
    if (sessionStorage.getItem('damaged')) return;
    sessionStorage.setItem('damaged', '1');
    localStorage.setItem('engage.v1', JSON.stringify({ offset: null, fov: 0, log: [null, { star: 'Sirius' }], seenIntro: true }));
    localStorage.setItem('engage.maru.v1', JSON.stringify({ runs: null }));
    localStorage.setItem('engage.missions.v1', JSON.stringify({ hails: null }));
    localStorage.setItem('engage.tonight.v1', JSON.stringify({ sky: 'bogus', place: { name: 'Nowhere' } }));
  });
  const p = await junk.newPage();
  const broke = [];
  p.on('pageerror', e => broke.push(e.message));
  await p.goto(base);
  await bridgeReady(p);
  assert.equal(await p.locator('#where').innerText(), 'Earth orbit');
  await p.click('#open-log');
  assert.match(await p.locator('#stats').innerText(), /Nothing logged yet/);
  for (const [file, hook] of [['maru.html', 'maru'], ['missions.html', 'missions'], ['tonight.html', 'tonight']]) {
    await p.goto(base + file);
    await p.waitForFunction(name => window[name], hook);
  }
  await p.click('#open-list');
  assert.match(await p.locator('#list-note').innerText(), /from the suburbs/);
  assert.deepEqual(broke, [], 'a damaged save stopped a page');
  await junk.close();
}

// Tonight's sky: reached from the bridge, the stars tagged where they really are, a tap on Vulcan, and a course set.
await page.goto(base);
await bridgeReady();
await Promise.all([page.waitForNavigation(), page.click('#open-sky')]);
await page.waitForFunction(() => window.tonight);
await page.evaluate(() => { tonight.place(40.71, -74.01, 'New York', 'America/New_York'); tonight.at('2026-10-11T04:30:00Z'); });
const vulcan = await page.evaluate(() => tonight.tag('Vulcan'));
assert.ok(vulcan.alt > 20 && vulcan.alt < 26, `Vulcan’s sun is not where it is at 12:30 am in New York: ${vulcan.alt}`);
assert.ok(vulcan.seen, 'a magnitude 4.4 star is not visible from the suburbs');
assert.equal(await page.evaluate(() => tonight.tag('Wolf 359').seen), false, 'Wolf 359 can be seen without a telescope');
assert.match(await text('#clock'), /12:30/);
assert.equal(await shown('#daylight'), false, 'the daylight notice shows at night');
await page.evaluate(() => tonight.aimAt('Vulcan'));
await page.waitForTimeout(200);
const spot = await page.evaluate(() => tonight.where('Vulcan'));
await page.touchscreen.tap(spot.x, spot.y);
assert.equal(await text('#card-title'), 'Vulcan', 'tapping the tag did not open Vulcan');
assert.match(await text('#card-look'), /up in the south-east/);
// With the card open, looking somewhere else stays put when the sky is worked out again (every 20 seconds, and
// whenever the time slider moves), while the card keeps up.
const lookBefore = await text('#card-look');
await page.evaluate(() => tonight.look(60, 30));
await page.locator('#time').evaluate(el => { el.value = 60; el.dispatchEvent(new Event('input')); });
await page.waitForTimeout(1200);
const looking = await page.evaluate(() => tonight.state.view);
assert.ok(Math.abs(looking.az - 60) < 0.5 && Math.abs(looking.alt - 30) < 0.5, `the card turned the view back to its star (${looking.az}, ${looking.alt})`);
assert.notEqual(await text('#card-look'), lookBefore, 'the card did not keep up with the sky');
await page.locator('#time').evaluate(el => { el.value = 0; el.dispatchEvent(new Event('input')); });
const skyLit = await page.evaluate(() => {
  const c = document.getElementById('view'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 300) n++;
  return n;
});
assert.ok(skyLit > 500, 'the sky is not drawn');
// The list, and a city picked by hand.
await page.click('[data-close]');
await page.click('#open-list');
assert.match(await text('#list-note'), /of Starfleet’s \d+ charted stars/);
assert.match(await page.locator('.system.trek').first().innerText(), /Vulcan|Capella|Aldebaran|Rigel|Pollux|Farpoint|Vega|Altair/);
await page.locator('#list [data-close]').click();
await page.click('#open-place');
await page.locator('.city', { hasText: 'Sydney' }).click();
assert.equal(await text('#place-name'), 'Sydney');
assert.ok(await page.evaluate(() => tonight.tag('Cochrane’s home').alt) > 0, 'Alpha Centauri is not up from Sydney');
// Holding the phone up toward the east, 30° above the horizon.
await page.evaluate(() => tonight.sense(270, 120, 0));
const pointing = await page.evaluate(() => tonight.pointing());
assert.ok(Math.abs(pointing.az - 90) < 1 && Math.abs(pointing.alt - 30) < 1, 'the sky does not follow the phone');
await page.evaluate(() => tonight.unsense());
// When the Moon, not the sky, hides a star, the card says so. Under a dark sky in New York late on 25 October 2026,
// the Moon brings the limit down to 5.1, just past Tellar (61 Cygni, magnitude 5.2).
await page.click('#open-place');
await page.click('.sky-opt[data-id="dark"]');
await page.locator('#places [data-close]').click();
await page.evaluate(() => { tonight.place(40.71, -74.01, 'New York', 'America/New_York'); tonight.at('2026-10-26T02:00:00Z'); });
await page.click('#open-list');
assert.match(await text('#list-note'), /bright enough to see under a dark sky\.$/);
await page.locator('.system', { hasText: 'Tellar' }).click();
assert.match(await text('#card-look'), /up in the west\. The Moon is washing it out tonight\.$/, 'the card blamed the sky for the Moon');
await page.locator('#card [data-close]').click();
await page.click('#open-place');
await page.click('.sky-opt[data-id="suburb"]');
await page.locator('#places [data-close]').click();
// In daylight it says so, and offers the evening.
await page.evaluate(() => { tonight.place(40.71, -74.01, 'New York', 'America/New_York'); tonight.at('2026-10-10T17:00:00Z'); });
assert.equal(await shown('#daylight'), true, 'no daylight notice at noon');
// Tags stay out from under the notice: with the Vega colony's star right behind it, its tag isn't drawn there.
{
  await page.evaluate(() => tonight.aimAt('Vega colony'));
  const notice = await page.locator('#daylight').boundingBox();
  await page.evaluate(y => {
    const { az } = tonight.state.view;
    let { alt } = tonight.state.view;
    for (let k = 0; k < 40; k++) { alt += (y - tonight.where('Vega colony').y) / 10; tonight.look(az, alt); }
  }, notice.y + notice.height / 2);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  assert.ok(Math.abs((await page.evaluate(() => tonight.where('Vega colony'))).y - (notice.y + notice.height / 2)) < 8, 'Vega is not behind the notice');
  for (const t of await page.evaluate(() => tonight.tags())) {
    assert.ok(t.x > notice.x + notice.width || t.x + t.w < notice.x || t.y > notice.y + notice.height || t.y + t.h < notice.y, `${t.name}’s tag is under the daylight notice`);
  }
}
await page.click('#go-dark');
assert.ok(await page.evaluate(() => tonight.state.sunAlt) < -11, 'show tonight did not move to the dark');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'tonight’s sky scrolls sideways on a phone');

// Away from the listed cities, the place is guessed from the time zone's standard time, not summer time: in July,
// Amsterdam's clocks are two hours ahead of UTC, but its zone is the one an hour ahead, 15° east.
{
  const summer = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Amsterdam' });
  const p = await summer.newPage();
  await p.clock.setFixedTime(new Date('2026-07-01T21:00:00Z'));
  await p.goto(base + 'tonight.html');
  await p.waitForFunction(() => window.tonight);
  const guess = await p.evaluate(() => tonight.state.place);
  assert.equal(guess.how, 'guess');
  assert.equal(guess.lon, 15, `guessed ${guess.lon}° from Amsterdam’s time zone in summer`);
  // A guess saved the old way, from summer time, is made again; a city picked by hand is kept.
  await p.evaluate(() => localStorage.setItem('engage.tonight.v1', JSON.stringify({ place: { name: 'your time zone', lat: 40, lon: 30, tz: 'Europe/Amsterdam', how: 'guess' }, sky: 'dark' })));
  await p.reload();
  await p.waitForFunction(() => window.tonight);
  assert.equal(await p.evaluate(() => tonight.state.place.lon), 15, 'an old guess made from summer time was kept');
  await p.evaluate(() => tonight.place(48.86, 2.35, 'Paris', 'Europe/Paris'));
  await p.reload();
  await p.waitForFunction(() => window.tonight);
  assert.equal(await p.evaluate(() => tonight.state.place.name), 'Paris', 'the city picked by hand was guessed over');
  await summer.close();
}
await page.evaluate(() => { tonight.at('2026-10-11T04:30:00Z'); tonight.aimAt('Vulcan'); });
await page.waitForTimeout(200);
const v2 = await page.evaluate(() => tonight.where('Vulcan'));
await page.touchscreen.tap(v2.x, v2.y);
await Promise.all([page.waitForNavigation(), page.click('#card-course')]);
await bridgeReady();
assert.equal(await text('#target-name'), '40 Eridani', 'set course did not choose Vulcan’s sun');

await page.goto(base);
await bridgeReady();

// With reduced motion, warp doesn't flash the screen white and the log doesn't animate in.
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.evaluate(() => {
  const el = document.getElementById('flash'), animate = el.animate.bind(el);
  window.flashes = 0;
  el.animate = (...a) => { window.flashes++; return animate(...a); };
  engage.speed(8); engage.target('Vega');
});
await page.click('#engage');
await page.waitForFunction(() => !document.getElementById('arrival').hidden, null, { timeout: 20000 });
assert.equal(await page.evaluate(() => window.flashes), 0, 'warp flashed the screen with reduced motion on');
assert.equal(await page.locator('#arrival-entry [style*="animation"]').count(), 0, 'the log animated in with reduced motion on');
await page.emulateMedia({ reducedMotion: null });

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
assert.ok(await page.title(), 'the page did not load offline');
await ctx.setOffline(false);

// Every tool at junkdrawer.works/ shares one address, and with it one place for offline copies. When Engage's
// service worker starts, it clears out Engage's own old copy and leaves other tools' alone. Both are made first,
// on a page of the site that doesn't start the service worker.
{
  const shared = await browser.newContext();
  const p = await shared.newPage();
  await p.goto(base + 'icon.svg');
  await p.evaluate(async () => {
    await (await caches.open('another-tool-v1')).put('another-tool/', new Response('another tool'));
    await (await caches.open('engage-v1')).put('index.html', new Response('an old Engage'));
  });
  await p.goto(base);
  await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 });
  const has = name => p.evaluate(n => caches.has(n), name);
  assert.equal(await has('another-tool-v1'), true, 'starting up deleted another tool’s offline copy');
  assert.equal(await has('engage-v1'), false, 'starting up left an old offline copy of Engage behind');
  await shared.close();
}

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
await browser.close();
server.close();
console.log('all good');
