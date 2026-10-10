// The long missions' numbers, checked without a browser:  node --test test/missions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jdOf, dateOf, readings, stateAt, earthAt, planetAt, heading, whenAbove, jwstFromEarth, trackUntil, LIGHT_DAY_AU, AU_KM } from '../js/ephemeris.js';
import { SHIPS } from '../js/ships.js';

const at = iso => jdOf(new Date(iso));

test('the yearly states land on the Horizons values they were joined from', () => {
  // Voyager 1 on 1 January 2026, straight from Horizons.
  const { pos } = stateAt('v1', 2461041.5);
  assert.deepEqual(pos.map(v => +v.toFixed(4)), [-31.8364, -134.6785, 97.4448]);
});

test('between the yearly states, positions follow the velocity smoothly', () => {
  for (const id of ['v1', 'v2', 'nh', 'p10', 'p11']) {
    const a = stateAt(id, at('2026-06-01')), b = stateAt(id, at('2026-06-02'));
    const moved = a.pos.map((v, k) => b.pos[k] - v);
    a.vel.forEach((v, k) => assert.ok(Math.abs(moved[k] - v) < 1e-5, `${id} jumps`));
  }
});

test('the ships are where NASA says, in October 2026', () => {
  const jd = at('2026-10-10');
  const v1 = readings('v1', jd), v2 = readings('v2', jd), nh = readings('nh', jd);
  assert.ok(v1.sunAU > 171 && v1.sunAU < 173, `Voyager 1 at ${v1.sunAU} AU`);
  assert.ok(v1.speedKmS > 16.8 && v1.speedKmS < 17.1);
  assert.ok(v2.sunAU > 143 && v2.sunAU < 145);
  assert.ok(nh.sunAU > 65 && nh.sunAU < 67);
  assert.ok(v1.lightSeconds / 3600 > 23.5 && v1.lightSeconds / 3600 < 24, 'Voyager 1 is nearly a light-day out');
  const webb = readings('jwst', jd);
  assert.ok(webb.earthAU * AU_KM > 1.0e6 && webb.earthAU * AU_KM < 1.9e6, 'Webb is not near L2');
});

test('Voyager 1 is one light-day from Earth in November 2026', () => {
  const t = whenAbove(jd => readings('v1', jd).earthAU, LIGHT_DAY_AU, at('2026-10-01'));
  const d = dateOf(t);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 10);
});

test('Earth crosses the March and September equinox points', () => {
  const lon = jd => { const e = earthAt(jd); return Math.atan2(e[1], e[0]) * 180 / Math.PI; };
  assert.ok(Math.abs(lon(at('2026-09-23'))) < 1.5);
  assert.ok(Math.abs(Math.abs(lon(at('2026-03-20'))) - 180) < 1.5);
});

test('the flybys line up with the planets', () => {
  const near = (id, planet, iso, au) => {
    const jd = at(iso);
    const ship = trackUntil(id, jd + 60).reduce((best, p) => {
      const d = Math.hypot(...p.map((v, k) => v - planetAt(planet, jd)[k]));
      return Math.min(best, d);
    }, Infinity);
    assert.ok(ship < au, `${id} misses ${planet} by ${ship.toFixed(2)} AU`);
  };
  near('v1', 'jupiter', '1979-03-05', 1);
  near('v2', 'neptune', '1989-08-25', 1);
  near('nh', 'pluto', '2015-07-14', 1);
});

test('each ship heads for the constellation its file names', () => {
  const jd = at('2026-10-10');
  const h = id => heading(id, jd);
  assert.ok(h('v1').ra > 16.5 && h('v1').ra < 18.5 && h('v1').dec > 0, 'Voyager 1 toward Ophiuchus');
  assert.ok(h('v2').dec < -50, 'Voyager 2 toward Pavo');
  assert.ok(h('p10').ra > 4 && h('p10').ra < 6, 'Pioneer 10 toward Taurus');
});

test('Webb is always beyond Earth, away from the Sun', () => {
  for (const iso of ['2026-10-15', '2027-03-01', '2027-08-01', '2029-01-01']) {
    const jd = at(iso), e = earthAt(jd), w = jwstFromEarth(jd);
    const out = (e[0] * w[0] + e[1] * w[1] + e[2] * w[2]) / Math.hypot(...e);
    assert.ok(out > 0, `Webb on the Sun's side on ${iso}`);
  }
});

test('every ship has a file to read', () => {
  for (const s of SHIPS) {
    assert.ok(s.name && s.tagline && s.now && s.log.length && s.bound.text, s.id);
    assert.doesNotThrow(() => readings(s.id, at('2026-10-10')));
  }
});
