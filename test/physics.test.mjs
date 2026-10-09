// The numbers and the log, checked without a browser:  node --test test/physics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { warpSpeed, apparentMag, formatDuration, formatLy, formatYear, tripYears, voyagerYears, physical, holdDistanceAU } from '../js/physics.js';
import { describeKind, homeLines, composeEntry } from '../js/log.js';
import { DESTINATIONS } from '../js/destinations.js';
import { CLASSES } from '../js/classes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// loadCatalog fetches relative URLs; answer them from the repo.
globalThis.fetch = async url => {
  const body = await readFile(join(root, String(url)));
  return { arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength), json: async () => JSON.parse(body) };
};
const { loadCatalog } = await import('../js/catalog.js');
const cat = await loadCatalog();
const at = name => { const i = cat.byName.get(name); return [cat.pos[i * 3], cat.pos[i * 3 + 1], cat.pos[i * 3 + 2]]; };

test('warp factors follow the familiar scale', () => {
  assert.equal(warpSpeed(1), 1);
  assert.ok(Math.abs(warpSpeed(9) - 1516) < 1);
  assert.ok(Math.abs(warpSpeed(9.9) - 3053) < 1);
  assert.ok(warpSpeed(9.5) > warpSpeed(9) && warpSpeed(9.5) < warpSpeed(9.9));
  for (let w = 1; w < 9.9; w += 0.1) assert.ok(warpSpeed(w + 0.1) > warpSpeed(w), `warp ${w}`);
});

test('trip times read sensibly', () => {
  assert.equal(formatDuration(tripYears(4.37, 9)), '1 day 1 hour');
  assert.equal(formatDuration(voyagerYears(4.37)), '77,000 years');
  assert.equal(formatDuration(4.2), '4 years');
  assert.equal(formatDuration(0.5 / 8766), '30 minutes');
  assert.equal(formatLy(0.0000008), '0.05 AU');
  assert.equal(formatYear(-470), '471 BCE');
});

test('the Sun comes out like the Sun', () => {
  const sun = physical(4.83, 0.656);
  assert.ok(Math.abs(sun.temp - 5772) < 100);
  assert.ok(Math.abs(sun.lum - 1) < 0.1);
  assert.ok(Math.abs(apparentMag(4.83, 1 / 206265) + 26.74) < 0.05);
  assert.ok(Math.abs(holdDistanceAU(1) - 0.213) < 0.01);
});

test('every destination is in the catalogue', () => {
  for (const d of DESTINATIONS) assert.ok(cat.byName.has(d.star), d.star);
  assert.equal(cat.names[0], 'Sol');
  assert.ok(cat.count > 18000);
});

test('from Alpha Centauri the Sun is a bright star in Cassiopeia', () => {
  const [first] = homeLines(cat, at('Rigil Kentaurus'), 2026, cat.byName.get('Rigil Kentaurus'));
  assert.match(first, /magnitude 0\.\d star.* in Cassiopeia\./);
});

test('from far away the Sun is too faint to see', () => {
  const [first] = homeLines(cat, at('Betelgeuse'), 2026, cat.byName.get('Betelgeuse'));
  assert.match(first, /too faint to see without a telescope/);
});

test('star kinds are described in words', () => {
  assert.equal(describeKind('K2III', 4500), 'Orange giant, spectral type K2III');
  assert.equal(describeKind('M4.5V', 3100), 'Red dwarf, spectral type M4.5V');
  assert.equal(describeKind('B8Ia', 12000), 'Blue-white supergiant, spectral type B8Ia');
  assert.equal(describeKind('DA2', 20000), 'White dwarf, spectral type DA2');
  assert.equal(describeKind('', 5800), 'Yellow dwarf');
});

test('a log entry covers the star, home and the trip', () => {
  const i = cat.byName.get('Proxima Centauri');
  const cam = at('Proxima Centauri');
  const e = composeEntry(cat, i, { cam, holdAU: 0.0485, warp: 9, fromTitle: 'Sol', tripLy: 4.24, date: new Date('2026-10-08T00:00:00Z') });
  const labels = e.sections.map(s => s[0]);
  for (const l of ['The star', 'Planets', 'Looking home', 'The trip']) assert.ok(labels.includes(l), l);
  assert.match(e.intro, /Proxima b’s orbit/);
  assert.match(e.sections.find(s => s[0] === 'Looking home')[1], /Cassiopeia/);
});

test('the offline copy lists every script', async () => {
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  for (const f of await readdir(join(root, 'js'))) assert.ok(sw.includes(`'js/${f}'`), f);
  for (const f of await readdir(join(root, 'fonts'))) if (f.endsWith('.woff2')) assert.ok(sw.includes(`'fonts/${f}'`), f);
});

test('every survey world Engage can fly to is in the catalogue', () => {
  for (const c of CLASSES) {
    for (const w of c.worlds) {
      if (!w.star) continue;
      const i = cat.byName.get(w.star);
      assert.ok(i !== undefined, `${w.name}: no star called ${w.star}`);
      const ly = Math.hypot(...at(w.star)) * 3.26156;
      assert.ok(Math.abs(ly - w.ly) / w.ly < 0.1, `${w.name}: file says ${w.ly} ly, catalogue says ${ly.toFixed(1)}`);
    }
  }
});

test('survey files are complete', () => {
  const ids = new Set();
  for (const c of CLASSES) {
    assert.ok(!ids.has(c.id), `two files called ${c.id}`);
    ids.add(c.id);
    for (const k of ['name', 'short', 'art', 'real', 'about', 'tell', 'home']) assert.ok(c[k], `${c.id} has no ${k}`);
    for (const k of ['width', 'mass', 'temp']) assert.ok(c.typical[k][0] < c.typical[k][1], `${c.id}: ${k} range is backwards`);
  }
});
