// Loads the stars: positions in parsecs from the Sun (x toward the March equinox, z toward the north celestial
// pole), how bright each really is, and the colour, temperature and size worked out from that.
import { physical, starColor } from './physics.js';
import { DESTINATIONS } from './destinations.js';

export async function loadCatalog() {
  const [bin, meta] = await Promise.all([
    fetch('data/stars.bin').then(r => r.arrayBuffer()),
    fetch('data/stars.json').then(r => r.json()),
  ]);
  const raw = new Float32Array(bin);
  const n = raw.length / 5;
  const pos = new Float64Array(n * 3);
  const absmag = new Float32Array(n);
  const color = new Float32Array(n * 3);
  const radius = new Float32Array(n); // in solar radii
  const temp = new Float32Array(n);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = raw[i * 5]; pos[i * 3 + 1] = raw[i * 5 + 1]; pos[i * 3 + 2] = raw[i * 5 + 2];
    absmag[i] = raw[i * 5 + 3];
    const p = physical(absmag[i], raw[i * 5 + 4]);
    temp[i] = p.temp; lum[i] = p.lum; radius[i] = p.radius;
  }
  const byName = new Map();
  meta.names.forEach((name, i) => { if (!byName.has(name)) byName.set(name, i); });

  // The stars with notes use the measured values rather than the estimates.
  for (const d of DESTINATIONS) {
    const i = byName.get(d.star);
    if (i === undefined) continue;
    temp[i] = d.temp; lum[i] = d.lum; radius[i] = d.radius;
  }
  for (let i = 0; i < n; i++) color.set(starColor(temp[i]), i * 3);

  return {
    count: n, pos, absmag, color, radius, temp, lum,
    names: meta.names, spect: meta.spect,
    constellations: meta.constellations, lines: meta.lines,
    byName,
    distanceFrom(i, p) {
      const dx = pos[i * 3] - p[0], dy = pos[i * 3 + 1] - p[1], dz = pos[i * 3 + 2] - p[2];
      return Math.hypot(dx, dy, dz);
    },
    // The constellation a direction falls in, by the IAU boundaries.
    constellationToward(dir) {
      const lon = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
      const lat = Math.asin(Math.max(-1, Math.min(1, dir[2]))) * 180 / Math.PI;
      for (const [c, ring] of meta.bounds) if (inside(ring, lon, lat)) return meta.constellations[c][1];
      return null;
    },
  };
}

// Point in a boundary ring on the sky. The ring is unwrapped across RA 12h; one that circles a pole is closed over it.
function inside(ring, lon, lat) {
  const pts = [[ring[0][0], ring[0][1]]];
  for (let k = 1; k < ring.length; k++) {
    let x = ring[k][0];
    x += Math.round((pts[k - 1][0] - x) / 360) * 360;
    pts.push([x, ring[k][1]]);
  }
  const span = pts[pts.length - 1][0] - pts[0][0];
  if (Math.abs(span) > 300) {
    const pole = pts.reduce((s, p) => s + p[1], 0) > 0 ? 90 : -90;
    pts.push([pts[pts.length - 1][0], pole], [pts[0][0], pole]);
  }
  for (const shift of [-360, 0, 360]) {
    const x = lon + shift;
    let hit = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [xa, ya] = pts[a], [xb, yb] = pts[b];
      if ((ya > lat) !== (yb > lat) && x < (xb - xa) * (lat - ya) / (yb - ya) + xa) hit = !hit;
    }
    if (hit) return true;
  }
  return false;
}
