// Checks the sky overlay's numbers: sidereal time, heights and bearings, the Sun, Moon and planets, and the charts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  jdOf, gmst, frame, toLocal, altAz, fromAltAz, sunDir, planetSky, moonSky, moonPhaseName, whereToLook, limitingMag, nextDark, phonePose,
} from '../js/astro.js';
import { CHARTS } from '../js/charts.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)))) * 180 / Math.PI;
const radec = (raH, decD) => { const r = raH * 15 * Math.PI / 180, d = decD * Math.PI / 180; return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)]; };

test('sidereal time', () => {
  near(gmst(2451545), 280.46, 0.01, 'at J2000');
  // 1 January 2026 0h UT: 6h 42m 41s (from the Astronomical Almanac's formula)
  near(gmst(jdOf(Date.UTC(2026, 0, 1))), (6 + 42 / 60 + 41 / 3600) * 15, 0.05, 'on 1 January 2026');
});

test('the pole star stands as high as your latitude', () => {
  const polaris = radec(2.53, 89.26);
  for (const lat of [51.5, 34, 10]) {
    const { alt, az } = altAz(toLocal(frame(lat, -0.1, jdOf(Date.UTC(2026, 9, 10, 22))), polaris));
    near(alt, lat, 1, `Polaris from latitude ${lat}`);
    assert.ok(az < 2 || az > 358, 'Polaris is not due north');
  }
});

test('a star crossing the meridian is due south at 90 minus the gap in latitude', () => {
  // Vega (RA 18h 36.9m, Dec +38.78) when the local sidereal time equals its RA.
  const jd0 = jdOf(Date.UTC(2026, 6, 1));
  const lon = 18.615 * 15 - gmst(jd0); // the longitude where it's on the meridian at that moment
  const { alt, az } = altAz(toLocal(frame(20, lon, jd0), radec(18.615, 38.78)));
  near(alt, 90 - (38.78 - 20), 0.05, 'Vega’s height');
  near(az, 0, 0.5, 'Vega north of the zenith when it culminates from 20°N');
});

test('the Sun at noon on the solstice', () => {
  // 21 June 2026, local noon at Greenwich-ish: the Sun about 73.4° up from 40°N.
  let best = -90;
  for (let m = 0; m < 240; m += 2) {
    const jd = jdOf(Date.UTC(2026, 5, 21, 10) + m * 60000);
    best = Math.max(best, altAz(toLocal(frame(40, 0, jd), sunDir(jd))).alt);
  }
  near(best, 90 - 40 + 23.44, 0.2, 'the Sun’s highest');
});

test('the planets are where they were seen', () => {
  // Mars at opposition on 16 January 2025: opposite the Sun.
  let jd = jdOf(Date.UTC(2025, 0, 16));
  assert.ok(angle(planetSky('mars', jd).dir, sunDir(jd)) > 175, 'Mars was not opposite the Sun');
  near(planetSky('mars', jd).mag, -1.4, 0.3, 'Mars at opposition');
  // Venus at greatest elongation, 10 January 2025: 47.2° from the Sun.
  jd = jdOf(Date.UTC(2025, 0, 10));
  near(angle(planetSky('venus', jd).dir, sunDir(jd)), 47.2, 1, 'Venus’s elongation');
  // Jupiter at opposition, 7 December 2024.
  jd = jdOf(Date.UTC(2024, 11, 7));
  assert.ok(angle(planetSky('jupiter', jd).dir, sunDir(jd)) > 177, 'Jupiter was not opposite the Sun');
  near(planetSky('jupiter', jd).mag, -2.8, 0.3, 'Jupiter at opposition');
});

test('the Moon’s phases', () => {
  const full = moonSky(jdOf(Date.UTC(2026, 9, 26, 4, 12)));  // full moon, 26 October 2026
  assert.ok(full.lit > 0.97, `not full: ${full.lit}`);
  const fresh = moonSky(jdOf(Date.UTC(2026, 9, 10, 15, 50))); // new moon, 10 October 2026
  assert.ok(fresh.lit < 0.03, `not new: ${fresh.lit}`);
  const q = moonSky(jdOf(Date.UTC(2026, 9, 18, 16)));          // first quarter, 18 October 2026
  assert.equal(moonPhaseName(q.lit, q.waxing), 'First quarter');
});

test('words for where to look', () => {
  assert.equal(whereToLook({ alt: 38.2, az: 134 }), '38° up in the south-east');
  assert.equal(whereToLook({ alt: 1, az: 271 }), 'on the horizon in the west');
  assert.equal(whereToLook({ alt: -20, az: 0 }), '20° below the horizon, under the north');
  assert.equal(whereToLook({ alt: 88, az: 0 }), 'straight overhead');
});

test('how faint you can see', () => {
  assert.equal(limitingMag('dark', -30), 6.3);
  assert.ok(limitingMag('city', -30) < limitingMag('suburb', -30));
  assert.ok(limitingMag('dark', -30, 1, 50) < 5.5, 'a full moon high up does not wash out the faint stars');
  assert.ok(limitingMag('dark', -8) < 3, 'twilight does not hide the faint stars');
  assert.ok(limitingMag('dark', 20) <= -1, 'stars show in daylight');
});

test('the next dark sky', () => {
  const noon = new Date(Date.UTC(2026, 9, 10, 17)); // noon in New York
  const dark = nextDark(40.7, -74, noon);
  const local = (dark.getUTCHours() + 24 - 4) % 24 + dark.getUTCMinutes() / 60;
  near(local, 19.75, 0.5, 'dark in New York in October');
});

test('the phone’s pose', () => {
  // Upright, top to the sky, screen facing you, you facing north: the camera looks north.
  let p = phonePose(0, 90, 0);
  near(angle(p.forward, [0, 1, 0]), 0, 0.01, 'facing north');
  near(angle(p.up, [0, 0, 1]), 0, 0.01, 'top up');
  // Turned to face east (the compass reading 90 means alpha 270).
  p = phonePose(270, 90, 0);
  near(angle(p.forward, [1, 0, 0]), 0, 0.01, 'facing east');
  near(angle(p.right, [0, -1, 0]), 0, 0.01, 'south on the right');
  // Lying flat, screen up: the camera looks at the ground.
  p = phonePose(0, 0, 0);
  near(angle(p.forward, [0, 0, -1]), 0, 0.01, 'looking down');
  // Turned on its side for landscape, still facing north: the screen's up is still the sky.
  p = phonePose(90, 0, -90, 90);
  near(angle(p.forward, [0, 1, 0]), 0, 0.01, 'landscape, facing north');
  near(angle(p.up, [0, 0, 1]), 0, 0.01, 'landscape, sky up');
  near(angle(fromAltAz(0, 90), [1, 0, 0]), 0, 0.01, 'east from an azimuth');
});

test('every chart names a star in the catalogue', async () => {
  const { names } = JSON.parse(await readFile(new URL('../data/stars.json', import.meta.url)));
  for (const c of CHARTS) assert.ok(names.includes(c.star), `${c.star} is not in the catalogue`);
});
