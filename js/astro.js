// Where things are in your own sky: turns the catalogue's directions into "how high, and which way" for a place on
// Earth and a moment, and finds the Sun, the Moon and the planets. Pure functions, so test/tonight.test.mjs can check them.
// Star directions are the catalogue's (the year 2000 equinox); the 26 years of precession since move them about a
// third of a degree, less than a phone's compass can tell.
import { planetAt, earthAt, moonAt } from './ephemeris.js';

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4393 * DEG;

export const jdOf = date => +date / 86400000 + 2440587.5;

// Greenwich mean sidereal time in degrees (IAU 1982, good to a fraction of a second this century).
export function gmst(jd) {
  const d = jd - 2451545, T = d / 36525;
  return (((280.46061837 + 360.98564736629 * d + 0.000387933 * T * T) % 360) + 360) % 360;
}

// The local frame for a place and moment, as three unit vectors in the catalogue's axes: east, north and up.
// A direction's height above the horizon and its bearing then come from dot products with these.
export function frame(lat, lon, jd) {
  const th = (gmst(jd) + lon) * DEG, ph = lat * DEG;
  const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
  return {
    east: [-st, ct, 0],
    north: [-sp * ct, -sp * st, cp],
    up: [cp * ct, cp * st, sp],
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A catalogue direction (any length) as [east, north, up] components of a unit vector.
export function toLocal(f, d) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [dot(d, f.east) / l, dot(d, f.north) / l, dot(d, f.up) / l];
}

// Altitude above the horizon and azimuth clockwise from north, both in degrees.
export function altAz(enu) {
  const alt = Math.asin(Math.max(-1, Math.min(1, enu[2]))) / DEG;
  const az = ((Math.atan2(enu[0], enu[1]) / DEG) + 360) % 360;
  return { alt, az };
}

export function fromAltAz(alt, az) {
  const a = alt * DEG, z = az * DEG;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
}

// The planets' tables are on the ecliptic; the stars are on the equator.
export function eclipticToEquatorial([x, y, z]) {
  const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
  return [x, c * y - s * z, s * y + c * z];
}

export const sunDir = jd => eclipticToEquatorial(earthAt(jd).map(v => -v));

// Brightness at 1 AU from both the Sun and Earth, and how much it fades per degree of phase.
const PLANET_MAG = { mercury: [-0.42, 0.038], venus: [-4.4, 0.01], mars: [-1.52, 0.016], jupiter: [-9.4, 0.005], saturn: [-8.88, 0.04], uranus: [-7.19, 0], neptune: [-6.87, 0] };
export const NAKED_EYE_PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];

// A planet seen from Earth: its direction (catalogue axes), distance in AU and magnitude.
export function planetSky(name, jd) {
  const p = planetAt(name, jd), e = earthAt(jd);
  const g = p.map((v, k) => v - e[k]);
  const r = Math.hypot(...p), delta = Math.hypot(...g);
  const cosPhase = (r * r + delta * delta - Math.hypot(...e) ** 2) / (2 * r * delta);
  const phase = Math.acos(Math.max(-1, Math.min(1, cosPhase))) / DEG;
  const [h, k] = PLANET_MAG[name];
  return { dir: eclipticToEquatorial(g), au: delta, mag: h + 5 * Math.log10(r * delta) + k * phase };
}

// The Moon: its direction, how much of it is lit (0 new to 1 full), and whether it's growing.
export function moonSky(jd) {
  const m = moonAt(jd), s = earthAt(jd).map(v => -v);
  const lonM = Math.atan2(m[1], m[0]), lonS = Math.atan2(s[1], s[0]);
  const cosE = dot(m, s) / (Math.hypot(...m) * Math.hypot(...s));
  const lit = (1 - cosE) / 2;
  const waxing = ((lonM - lonS) / DEG + 720) % 360 < 180;
  return { dir: eclipticToEquatorial(m), km: Math.hypot(...m), lit, waxing };
}

export function moonPhaseName(lit, waxing) {
  if (lit < 0.03) return 'New moon';
  if (lit > 0.97) return 'Full moon';
  if (Math.abs(lit - 0.5) < 0.06) return waxing ? 'First quarter' : 'Last quarter';
  return `${waxing ? 'Waxing' : 'Waning'} ${lit < 0.5 ? 'crescent' : 'gibbous'}`;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compassPoint = az => POINTS[Math.round(((az % 360) + 360) % 360 / 45) % 8];

// "38° up in the south-east", the way you'd tell someone where to look.
export function whereToLook({ alt, az }) {
  if (alt > 84) return 'straight overhead';
  if (alt < -0.5) return `${Math.round(-alt)}° below the horizon, under the ${compassPoint(az)}`;
  if (alt < 3) return `on the horizon in the ${compassPoint(az)}`;
  return `${Math.round(alt)}° up in the ${compassPoint(az)}`;
}

// How faint a star you can see: the darkness of the place, then however much the Sun and Moon wash out.
export const SKIES = {
  city: { label: 'City', mag: 3.5, note: 'Only the brightest stars through the glow' },
  suburb: { label: 'Suburbs', mag: 4.6, note: 'The main patterns of the constellations' },
  dark: { label: 'Dark sky', mag: 6.3, note: 'Everything the eye can see, Milky Way and all' },
};

export function limitingMag(sky, sunAlt, moonLit = 0, moonAlt = -90) {
  let m = SKIES[sky]?.mag ?? SKIES.suburb.mag;
  if (moonAlt > 0) m -= 1.2 * moonLit * Math.min(1, moonAlt / 20);
  if (sunAlt > -18) m = Math.min(m, 6.3 - (sunAlt + 18) * 0.42); // twilight brightens from astronomical to civil
  if (sunAlt > -2) m = Math.min(m, -1); // daylight: the Moon and Venus at most
  return m;
}

// The next moment after `from` when the sky is properly dark (the Sun 12° down), searched in 10 minute steps.
export function nextDark(lat, lon, from, hours = 36) {
  for (let t = 0; t <= hours * 6; t++) {
    const date = new Date(+from + t * 600000);
    const jd = jdOf(date);
    if (altAz(toLocal(frame(lat, lon, jd), sunDir(jd))).alt < -12) return date;
  }
  return null;
}

// The rest frame of the phone: which way the back camera faces, and the screen's right and up, in east-north-up,
// from the deviceorientation angles (degrees; alpha measured from north). `screenAngle` is the screen's rotation.
export function phonePose(alpha, beta, gamma, screenAngle = 0) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  // Columns of Rz(alpha) · Rx(beta) · Ry(gamma): the phone's own x (right), y (top) and z (out of the screen).
  const X = [ca * cg - sa * sb * sg, sa * cg + ca * sb * sg, -cb * sg];
  const Y = [-sa * cb, ca * cb, sb];
  const Z = [ca * sg + sa * sb * cg, sa * sg - ca * sb * cg, cb * cg];
  const t = screenAngle * DEG, ct = Math.cos(t), st = Math.sin(t);
  return {
    forward: Z.map(v => -v),
    right: X.map((v, k) => ct * v - st * Y[k]),
    up: Y.map((v, k) => ct * v + st * X[k]),
  };
}
