// The warp scale's numbers: the speeds match the bridge, the trips come out right, the places are in order, and the
// race clock gets every ship there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANES, PLACES, GROUPS, byId, distanceLy, laneSpeed, tripYears, raceClock, formatSpan, formatShort, formatLight, arrivalYear, lightLeft, ladderAt } from '../js/warp-scale.js';
import { warpSpeed } from '../js/physics.js';

const DATE = new Date('2026-10-24T00:00:00Z');
const lane = id => LANES.find(l => l.id === id);

test('warp 1 is light, and the warp factors use the bridge’s scale', () => {
  assert.equal(laneSpeed(lane('w1')), 1);
  assert.equal(laneSpeed(lane('w5')), warpSpeed(5));
  assert.ok(Math.abs(laneSpeed(lane('w5')) - 213.7) < 0.1);
  assert.ok(Math.abs(laneSpeed(lane('w9975')) - 6751) < 1);
  assert.equal(laneSpeed(lane('custom'), 9), warpSpeed(9));
  const v = laneSpeed(lane('voyager'), 9, DATE) * 299792.458;
  assert.ok(v > 16.5 && v < 17.5, `Voyager 1 at ${v} km/s`);
});

test('the ladder runs nearest first, and every place is described', () => {
  // The planets move about, so only the places that stay put have to be in order; the page sorts the rest each day.
  const groups = GROUPS.map(g => g[0]);
  let last = 0, lastGroup = 0;
  for (const p of PLACES) {
    const ly = distanceLy(p, DATE);
    if (!p.live) assert.ok(ly > last, `${p.name} is out of order`);
    assert.ok(groups.indexOf(p.group) >= lastGroup, `${p.name} is in the wrong group`);
    if (!p.live) last = ly;
    lastGroup = groups.indexOf(p.group);
    assert.ok(p.about && /^#[0-9a-f]{6}$/.test(p.color), p.name);
    assert.equal(byId.get(p.id), p);
  }
});

test('the Solar System’s distances are for the day', () => {
  const ls = id => distanceLy(byId.get(id), DATE) * 31557600;
  assert.ok(ls('moon') > 1.18 && ls('moon') < 1.36, `the Moon at ${ls('moon')} light-seconds`);
  assert.ok(ls('sun') > 490 && ls('sun') < 510);
  assert.ok(ls('mars') / 60 > 3 && ls('mars') / 60 < 23);
  const v = ls('voyager') / 3600;
  assert.ok(v > 23 && v < 25, `Voyager 1 is ${v} light-hours away`);
});

test('the places with Set course are stars the bridge knows', async () => {
  const names = new Set(JSON.parse(await readFile(new URL('../data/stars.json', import.meta.url))).names);
  for (const p of PLACES.filter(p => p.course)) assert.ok(names.has(p.course), p.course);
});

test('the famous numbers come out right', () => {
  const core = distanceLy(byId.get('core'));
  assert.equal(formatSpan(tripYears(core, laneSpeed(lane('w9975')))), '3 years 11 months');
  // Janeway's 75 years home, nonstop at warp 9.975.
  assert.equal(formatSpan(tripYears(70000, laneSpeed(lane('w9975')))), '10 years 4 months');
  assert.equal(formatSpan(tripYears(4.23, 1)), '4 years 3 months');
});

test('the race clock starts before the fastest arrives and ends after the slowest', () => {
  for (const p of PLACES) {
    const times = LANES.map(l => tripYears(distanceLy(p, DATE), laneSpeed(l, 9, DATE)));
    const c = raceClock(times);
    assert.ok(c.seconds >= 5 && c.seconds <= 13);
    assert.ok(c.at(0) < Math.min(...times));
    assert.ok(c.at(c.seconds) > Math.max(...times));
    for (const t of times) assert.ok(Math.abs(c.at(c.when(t)) - t) / t < 1e-9);
  }
});

test('spans and distances read naturally', () => {
  const s = 1 / 31557600;
  assert.equal(formatSpan(0.00019 * s), '190 microseconds');
  assert.equal(formatSpan(0.074 * s), '74 milliseconds');
  assert.equal(formatSpan(1.3 * s), '1.3 seconds');
  assert.equal(formatSpan(500 * s), '8 minutes');
  assert.equal(formatSpan(26 * 3600 * s), '1 day 2 hours');
  assert.equal(formatSpan(120.4), '120 years');
  assert.equal(formatSpan(473e6), '473 million years');
  assert.equal(formatSpan(4.5e10), '45 billion years');
  assert.equal(formatShort(3.95), '4 yr');
  assert.equal(formatShort(2.5e6), '2.5M yr');
  assert.equal(formatLight(1.28 * s), '1.3 light-seconds');
  assert.equal(formatLight(26670), '26,700 light years');
  assert.equal(formatLight(2537000), '2.5 million light years');
  assert.equal(arrivalYear(3.95, DATE), '2031');
  assert.equal(arrivalYear(0.5, DATE), null);
  assert.equal(lightLeft(4.23, DATE), 'in 2023');
  assert.equal(lightLeft(26670, DATE), '27,000 years ago');
  for (const p of PLACES) {
    const x = ladderAt(distanceLy(p, DATE));
    assert.ok(x > 0 && x < 1, p.name);
  }
});
