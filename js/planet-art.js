// Paints planets: a surface map made from 3D noise for each kind of world, wrapped onto a lit, turning sphere.
// No images and no WebGL: the map is worked out once, then each frame only looks pixels up in it.

// ---------- Noise ----------

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function makeNoise(seed) {
  const r = rng(seed);
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => { const g = G[h % 12]; return g[0] * x + g[1] * y + g[2] * z; };
  // Perlin noise, roughly -1..1.
  const noise = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const a = p[xi] + yi, aa = p[a] + zi, ab = p[a + 1] + zi, b = p[xi + 1] + yi, ba = p[b] + zi, bb = p[b + 1] + zi;
    const l = (t, m, n) => m + t * (n - m);
    return l(w,
      l(v, l(u, grad(p[aa], x, y, z), grad(p[ba], x - 1, y, z)), l(u, grad(p[ab], x, y - 1, z), grad(p[bb], x - 1, y - 1, z))),
      l(v, l(u, grad(p[aa + 1], x, y, z - 1), grad(p[ba + 1], x - 1, y, z - 1)), l(u, grad(p[ab + 1], x, y - 1, z - 1), grad(p[bb + 1], x - 1, y - 1, z - 1))));
  };
  const fbm = (x, y, z, oct = 5, lac = 2, gain = 0.5) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f, z * f); f *= lac; a *= gain; }
    return s;
  };
  const ridged = (x, y, z, oct = 5) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise(x * f, y * f, z * f))); f *= 2; a *= 0.5; }
    return s;
  };
  // Distance to the nearest of a scatter of points, for craters.
  const cell = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    let d1 = 9, size = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const h = p[(p[(p[(X + i) & 255] + Y + j) & 255] + Z + k) & 255];
      const h2 = p[(h + 37) & 255], h3 = p[(h + 101) & 255];
      const dx = X + i + h / 255 - x, dy = Y + j + h2 / 255 - y, dz = Z + k + h3 / 255 - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < d1) { d1 = d; size = h3 / 255; }
    }
    return [Math.sqrt(d1), size];
  };
  return { noise, fbm, ridged, cell, r };
}

// ---------- Colour helpers ----------

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// A colour from a list of stops along 0..1.
function ramp(stops, t) {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
const stops = list => list.map(([t, h]) => [t, hex(h)]);
// Nudges a colour's hue by turning it around the grey axis.
function tint(c, turn) {
  if (!turn) return c;
  const k = Math.cos(turn), s = Math.sin(turn), m = (c[0] + c[1] + c[2]) / 3;
  const x = c[0] - m, y = c[1] - m, z = c[2] - m;
  const a = 0.57735; // rotate around (1,1,1)/√3
  const dot = a * (x + y + z);
  const cx = a * (y - z) * -1, cy = a * (z - x) * -1, cz = a * (x - y) * -1;
  return [m + x * k + cx * s + a * dot * (1 - k), m + y * k + cy * s + a * dot * (1 - k), m + z * k + cz * s + a * dot * (1 - k)];
}

// ---------- The worlds ----------
// Each style returns per point (x, y, z on the unit sphere, lat in -1..1 as y):
// colour [r,g,b], glow (light of its own, 0..1 as rgb), cloud cover 0..1.
// `look` describes the sphere: atmosphere colour and thickness, light, cloud colour, and the halo.

const STYLES = {
  earth: {
    look: { atm: [110, 170, 255], atmK: 0.9, cloud: [255, 255, 255], spin: 1 },
    make(n, v) {
      const sea = 0.02 + v.r() * 0.08;
      const ice = 0.78 + v.r() * 0.08;
      return (x, y, z) => {
        const w = n.fbm(x * 1.2 + 9, y * 1.2, z * 1.2, 3) * 0.6;
        const h = n.fbm(x * 1.6 + w, y * 1.6 + w, z * 1.6, 6);
        const lat = Math.abs(y);
        let c;
        if (h < sea) c = mix(hex('#0b2a5b'), hex('#1d5d9c'), smooth(sea - 0.35, sea, h));
        else {
          const e = (h - sea) * 3;
          const dry = smooth(0.15, 0.45, n.fbm(x * 3, y * 3 + 5, z * 3, 3) + 0.25 - Math.abs(lat - 0.3));
          c = mix(mix(hex('#2f6b2a'), hex('#c7a86b'), dry), hex('#7a6a58'), smooth(0.35, 0.7, e));
        }
        const iceT = smooth(ice, ice + 0.05, lat + n.fbm(x * 4, y * 4, z * 4, 3) * 0.12);
        c = mix(c, hex('#f2f6fb'), iceT);
        const cw = n.fbm(x * 2 + 3, y * 2, z * 2 - 4, 3);
        const cl = smooth(0.0, 0.35, n.fbm(x * 2.5 + cw * 1.4, y * 5 + cw, z * 2.5, 5) + 0.05);
        return [c, null, cl];
      };
    },
  },
  forest: {
    look: { atm: [140, 200, 220], atmK: 0.7, cloud: [245, 250, 245], spin: 1 },
    make(n, v) {
      const sea = -0.2 - v.r() * 0.08;
      return (x, y, z) => {
        const h = n.fbm(x * 1.8, y * 1.8, z * 1.8, 6);
        const lat = Math.abs(y);
        let c;
        if (h < sea) c = mix(hex('#123d4a'), hex('#2d6e72'), smooth(sea - 0.2, sea, h));
        else {
          const t = n.fbm(x * 5 + 2, y * 5, z * 5, 4);
          c = mix(hex('#173d1c'), hex('#3f7a2c'), smooth(-0.3, 0.3, t));
          c = mix(c, hex('#8a9a4a'), smooth(0.25, 0.6, h - sea - 0.25 + lat * 0.3));
        }
        c = mix(c, hex('#e9efe9'), smooth(0.88, 0.94, lat + h * 0.1));
        const cl = smooth(0.12, 0.42, n.fbm(x * 3 + 7, y * 4, z * 3, 5));
        return [c, null, cl * 0.8];
      };
    },
  },
  mars: {
    look: { atm: [235, 170, 130], atmK: 0.35, cloud: [250, 235, 220], spin: 1 },
    make(n) {
      const pal = stops([[0, '#4a2214'], [0.35, '#8c3f22'], [0.6, '#b8613a'], [0.85, '#d8935f'], [1, '#e6b487']]);
      return (x, y, z) => {
        const h = n.fbm(x * 1.4, y * 1.4, z * 1.4, 6);
        const dark = smooth(-0.05, -0.3, n.fbm(x * 2 + 4, y * 2, z * 2, 4));
        let c = ramp(pal, 0.55 + h * 0.9);
        c = mix(c, hex('#3b1f16'), dark * 0.55);
        const [d, s] = n.cell(x * 7, y * 7, z * 7);
        const r = 0.12 + s * 0.18;
        if (d < r * 1.25) c = mix(c, d < r ? mix(c, hex('#2e1810'), 0.25) : mix(c, hex('#e0a676'), 0.3), 0.8);
        const cap = smooth(0.86, 0.9, Math.abs(y) + n.fbm(x * 6, y * 6, z * 6, 3) * 0.06);
        c = mix(c, hex('#f4ece4'), cap);
        return [c, null, smooth(0.35, 0.6, n.fbm(x * 3, y * 6, z * 3, 4)) * 0.25];
      };
    },
  },
  desert: {
    look: { atm: [235, 200, 150], atmK: 0.45, cloud: [250, 240, 225], spin: 1 },
    make(n, v) {
      const pal = stops([[0, '#7a4a22'], [0.4, '#c48a48'], [0.7, '#e2b878'], [1, '#f1d9a4']]);
      const turn = (v.r() - 0.5) * 0.3;
      return (x, y, z) => {
        const w = n.fbm(x * 2, y * 2, z * 2, 3);
        const dunes = Math.sin((x * 30 + y * 18 + w * 12)) * 0.5 + 0.5;
        const h = n.fbm(x * 1.5 + 3, y * 1.5, z * 1.5, 6);
        let c = ramp(pal, 0.5 + h * 0.9 + dunes * 0.08);
        c = mix(c, hex('#5e3a22'), smooth(0.2, 0.45, n.ridged(x * 3, y * 3, z * 3, 4) - 0.55) * 0.7);
        c = mix(c, hex('#f3ead6'), smooth(-0.32, -0.42, h) * 0.8); // salt flats
        return [tint(c, turn), null, smooth(0.42, 0.65, n.fbm(x * 3, y * 5, z * 3, 4)) * 0.3];
      };
    },
  },
  venus: {
    look: { atm: [255, 225, 150], atmK: 1.2, cloud: [0, 0, 0], spin: 0.5 },
    make(n) {
      const pal = stops([[0, '#9a7a3e'], [0.35, '#c9a764'], [0.65, '#e6cf96'], [1, '#f6ead0']]);
      return (x, y, z) => {
        const w = n.fbm(x * 1.5, y * 3, z * 1.5, 4);
        const band = Math.sin(y * 9 + w * 3.5) * 0.5 + 0.5;
        const t = n.fbm(x * 2 + w * 2, y * 6, z * 2, 5);
        return [ramp(pal, 0.45 + band * 0.25 + t * 0.5), null, 0];
      };
    },
  },
  ocean: {
    look: { atm: [110, 175, 255], atmK: 1, cloud: [255, 255, 255], spin: 1 },
    make(n) {
      return (x, y, z) => {
        const h = n.fbm(x * 2.2, y * 2.2, z * 2.2, 6);
        let c = mix(hex('#06214a'), hex('#1b5ea8'), smooth(-0.5, 0.4, h));
        if (h > 0.36) c = mix(hex('#d9c793'), hex('#3c7a3a'), smooth(0.38, 0.45, h));
        c = mix(c, hex('#eef4fb'), smooth(0.9, 0.95, Math.abs(y)));
        const sw = n.fbm(x * 1.5 + 2, y * 1.5, z * 1.5, 3) * 2;
        const cl = smooth(-0.02, 0.32, n.fbm(x * 2.5 + sw, y * 5 + sw * 0.5, z * 2.5 - sw, 5));
        return [c, null, cl];
      };
    },
  },
  ice: {
    look: { atm: [190, 220, 255], atmK: 0.4, cloud: [255, 255, 255], spin: 1 },
    make(n) {
      return (x, y, z) => {
        const h = n.fbm(x * 1.6, y * 1.6, z * 1.6, 5);
        let c = mix(hex('#a9c2d8'), hex('#f2f7fb'), smooth(-0.4, 0.3, h));
        const crack = smooth(0.92, 0.985, n.ridged(x * 4, y * 4, z * 4, 4) / 0.95);
        c = mix(c, hex('#6f8fae'), crack * 0.7);
        c = mix(c, hex('#4f7ea6'), smooth(-0.3, -0.45, h) * 0.6);
        return [c, null, smooth(0.3, 0.6, n.fbm(x * 3, y * 5, z * 3, 4)) * 0.3];
      };
    },
  },
  rock: {
    look: { atm: null, atmK: 0, cloud: [0, 0, 0], spin: 1 },
    make(n, v) {
      const warm = v.r();
      const pal = stops([[0, warm > 0.5 ? '#3b3530' : '#33363b'], [0.5, warm > 0.5 ? '#7d7266' : '#6f7378'], [1, warm > 0.5 ? '#b9ab98' : '#aeb3b8']]);
      return (x, y, z) => {
        const h = n.fbm(x * 1.8, y * 1.8, z * 1.8, 6);
        let c = ramp(pal, 0.5 + h * 1.1);
        c = mix(c, ramp(pal, 0.15), smooth(-0.1, -0.35, n.fbm(x * 1.2 + 5, y * 1.2, z * 1.2, 3)) * 0.6); // dark plains
        for (const [k, a] of [[5, 1], [11, 0.8], [23, 0.5]]) {
          const [d, s] = n.cell(x * k + k, y * k, z * k);
          const r = 0.1 + s * 0.25;
          if (d < r) c = mix(c, hex('#2a2a2c'), (0.25 + 0.2 * (1 - d / r)) * a);
          else if (d < r * 1.3) c = mix(c, hex('#d8d4cc'), 0.35 * a * (1 - (d - r) / (r * 0.3)));
        }
        return [c, null, 0];
      };
    },
  },
  demon: {
    look: { atm: [190, 230, 80], atmK: 0.9, cloud: [175, 190, 70], spin: 1 },
    make(n) {
      return (x, y, z) => {
        const h = n.fbm(x * 1.8, y * 1.8, z * 1.8, 5);
        let c = mix(hex('#1a1210'), hex('#4a3428'), smooth(-0.4, 0.4, h));
        const rift = smooth(0.9, 0.99, n.ridged(x * 3, y * 3, z * 3, 5) / 0.95);
        const glow = rift * (0.6 + 0.4 * smooth(-0.2, 0.3, n.fbm(x * 6, y * 6, z * 6, 2)));
        const cl = smooth(0.05, 0.4, n.fbm(x * 2.5 + 3, y * 4, z * 2.5, 5));
        return [c, [255 * glow, 110 * glow, 20 * glow], cl * 0.7];
      };
    },
  },
  jovian: {
    look: { atm: [240, 215, 170], atmK: 0.35, cloud: [0, 0, 0], spin: 1.6, gas: true },
    make(n, v) {
      const pals = [
        stops([[0, '#6e4a2e'], [0.3, '#b07a4a'], [0.5, '#e8d2ae'], [0.7, '#c49464'], [1, '#f3e7d2']]),
        stops([[0, '#8a7350'], [0.3, '#c8ad7a'], [0.55, '#efe0b8'], [0.8, '#d6bd8a'], [1, '#f6edd5']]),
      ];
      const pal = pals[Math.floor(v.r() * pals.length)];
      const freq = 9 + v.r() * 6;
      const spot = [v.r() * Math.PI * 2, -0.25 - v.r() * 0.15];
      return (x, y, z) => {
        const w = n.fbm(x * 2, y * 8, z * 2, 5);
        const b = Math.sin(y * freq + w * 2.2) * 0.5 + 0.5;
        const b2 = Math.sin(y * freq * 2.7 + w * 3) * 0.5 + 0.5;
        let c = ramp(pal, b * 0.75 + b2 * 0.25 + n.fbm(x * 6, y * 20, z * 6, 3) * 0.2);
        const lon = Math.atan2(x, z);
        const dl = Math.atan2(Math.sin(lon - spot[0]), Math.cos(lon - spot[0]));
        const e = (dl * dl) / 0.07 + ((y - spot[1]) ** 2) / 0.006;
        if (e < 1) c = mix(c, mix(hex('#b2532d'), hex('#d98a5a'), e), smooth(1, 0.5, e));
        return [c, null, 0];
      };
    },
  },
  ultra: {
    look: { atm: [220, 130, 170], atmK: 0.45, cloud: [0, 0, 0], spin: 1.6, gas: true },
    make(n, v) {
      const pal = stops([[0, '#3a1a2c'], [0.35, '#6a3550'], [0.6, '#91506a'], [0.85, '#bd7d80'], [1, '#dcae9c']]);
      const freq = 12 + v.r() * 5;
      return (x, y, z) => {
        const w = n.fbm(x * 2, y * 7, z * 2, 5);
        const b = Math.sin(y * freq + w * 2.6) * 0.5 + 0.5;
        const c = ramp(pal, b * 0.8 + n.fbm(x * 5, y * 16, z * 5, 3) * 0.3 + 0.1);
        const g = 0.18 * smooth(0.4, 0.9, b);
        return [c, [255 * g, 70 * g, 60 * g], 0];
      };
    },
  },
  rogue: {
    look: { atm: [90, 120, 170], atmK: 0.3, cloud: [0, 0, 0], spin: 0.6, dark: true },
    make(n) {
      return (x, y, z) => {
        const h = n.fbm(x * 1.6, y * 1.6, z * 1.6, 5);
        let c = mix(hex('#141b28'), hex('#4a5b74'), smooth(-0.4, 0.4, h));
        c = mix(c, hex('#8ea3bf'), smooth(0.93, 0.99, n.ridged(x * 4, y * 4, z * 4, 4) / 0.95) * 0.6);
        return [c, null, 0];
      };
    },
  },
  superearth: {
    look: { atm: [150, 200, 220], atmK: 1.4, cloud: [235, 240, 240], spin: 0.8 },
    make(n) {
      return (x, y, z) => {
        const h = n.fbm(x * 2.6, y * 2.6, z * 2.6, 6);
        let c;
        if (h < 0.12) c = mix(hex('#0c2f3a'), hex('#1f6a70'), smooth(-0.4, 0.12, h));
        else c = mix(mix(hex('#6a4a32'), hex('#8c6a48'), smooth(0.12, 0.3, h)), hex('#3a2a22'), smooth(0.3, 0.55, h));
        const w = n.fbm(x * 2, y * 2, z * 2, 3);
        const cl = smooth(0.1, 0.5, Math.sin(y * 14 + w * 4) * 0.35 + n.fbm(x * 3 + 2, y * 8, z * 3, 5) + 0.15);
        return [c, null, cl * 0.75];
      };
    },
  },
  subneptune: {
    look: { atm: [170, 205, 235], atmK: 1.3, cloud: [0, 0, 0], spin: 1.2, gas: true },
    make(n, v) {
      const turn = (v.r() - 0.5) * 0.5;
      return (x, y, z) => {
        const w = n.fbm(x * 1.5, y * 4, z * 1.5, 4);
        const b = Math.sin(y * 7 + w * 1.5) * 0.5 + 0.5;
        const c = mix(hex('#6f8ea8'), hex('#c9d8e2'), b * 0.6 + n.fbm(x * 3, y * 8, z * 3, 3) * 0.4 + 0.2);
        return [tint(c, turn), null, 0];
      };
    },
  },
  lava: {
    look: { atm: [255, 150, 70], atmK: 0.4, cloud: [0, 0, 0], spin: 0.4, lava: true },
    make(n) {
      return (x, y, z) => {
        const h = n.fbm(x * 2, y * 2, z * 2, 6);
        const crust = mix(hex('#121010'), hex('#3a2c26'), smooth(-0.3, 0.4, h));
        const molten = smooth(-0.05, -0.2, h); // low ground is a sea of magma
        const crack = smooth(0.93, 0.99, n.ridged(x * 5, y * 5, z * 5, 4) / 0.95);
        const g = Math.max(molten, crack * 0.7);
        return [crust, [255 * g, 120 * g * g + 40 * g, 20 * g], 0];
      };
    },
  },
  hotjupiter: {
    look: { atm: [255, 150, 90], atmK: 0.6, cloud: [0, 0, 0], spin: 1.4, gas: true, nightGlow: true },
    make(n) {
      const pal = stops([[0, '#1d1214'], [0.4, '#4b2a26'], [0.7, '#7a4434'], [1, '#a9705a']]);
      return (x, y, z) => {
        const w = n.fbm(x * 2, y * 6, z * 2, 5);
        const b = Math.sin(y * 10 + w * 2.5) * 0.5 + 0.5;
        const c = ramp(pal, b * 0.7 + n.fbm(x * 5, y * 14, z * 5, 3) * 0.3 + 0.15);
        const g = 0.2 + 0.25 * b;
        return [c, [220 * g, 60 * g, 25 * g], 0];
      };
    },
  },
  icegiant: {
    look: { atm: [150, 220, 255], atmK: 0.8, cloud: [0, 0, 0], spin: 1.3, gas: true },
    make(n, v) {
      const deep = v.r() < 0.5;
      const a = deep ? hex('#1f3f9a') : hex('#6fb6c8'), b = deep ? hex('#4a78d6') : hex('#a8dde4');
      const spot = [v.r() * Math.PI * 2, -0.2 - v.r() * 0.2];
      return (x, y, z) => {
        const w = n.fbm(x * 1.5, y * 5, z * 1.5, 4);
        const band = Math.sin(y * 8 + w * 1.2) * 0.5 + 0.5;
        let c = mix(a, b, band * 0.5 + n.fbm(x * 3, y * 10, z * 3, 3) * 0.3 + 0.25);
        if (deep) {
          const lon = Math.atan2(x, z), dl = Math.atan2(Math.sin(lon - spot[0]), Math.cos(lon - spot[0]));
          const e = dl * dl / 0.05 + (y - spot[1]) ** 2 / 0.005;
          if (e < 1) c = mix(c, hex('#13275e'), smooth(1, 0.4, e));
          c = mix(c, hex('#eef6ff'), smooth(0.55, 0.75, n.fbm(x * 4, y * 18, z * 4, 3) + 0.2) * 0.8);
        }
        return [c, null, 0];
      };
    },
  },
};

export const STYLE_NAMES = Object.keys(STYLES);

// ---------- The surface map ----------

// Works out a world's map once: colour, its own glow, and cloud cover, `w` by `w/2` texels in longitude and latitude.
export function paint(style, seed = 1, w = 384) {
  const job = painter(style, seed, w);
  while (!job.step(Infinity));
  return job.map;
}

// The same, a few rows at a time so the page stays responsive. Resolves to null if `stale()` turns true first.
export async function paintSoon(style, seed = 1, w = 384, stale = () => false) {
  const job = painter(style, seed, w);
  for (;;) {
    if (stale()) return null;
    const until = performance.now() + 10;
    if (job.step(until)) return job.map;
    await new Promise(r => setTimeout(r, 0));
  }
}

function painter(style, seed, w) {
  const S = STYLES[style];
  const n = makeNoise(seed);
  const v = { r: rng(seed * 7 + 3) };
  const at = S.make(n, v);
  const h = w >> 1;
  const color = new Uint8ClampedArray(w * h * 3);
  const glow = new Uint8ClampedArray(w * h * 3);
  const cloud = new Uint8ClampedArray(w * h);
  let glows = false, clouds = false, j = 0;
  const job = {
    map: null,
    // Paints rows until the clock passes `until`; true once the map is done.
    step(until) {
      for (; j < h; j++) {
        if (performance.now() > until) return false;
        const lat = (0.5 - (j + 0.5) / h) * Math.PI;
        const y = Math.sin(lat), cl = Math.cos(lat);
        for (let i = 0; i < w; i++) {
          const lon = ((i + 0.5) / w) * Math.PI * 2;
          const x = cl * Math.sin(lon), z = cl * Math.cos(lon);
          const [c, g, k] = at(x, y, z);
          const o = j * w + i;
          color[o * 3] = c[0]; color[o * 3 + 1] = c[1]; color[o * 3 + 2] = c[2];
          if (g) { glow[o * 3] = g[0]; glow[o * 3 + 1] = g[1]; glow[o * 3 + 2] = g[2]; glows = true; }
          if (k) { cloud[o] = k * 255; clouds = true; }
        }
      }
      job.map = { w, h, color, glow: glows ? glow : null, cloud: clouds ? cloud : null, look: S.look, style };
      return true;
    },
  };
  return job;
}

// ---------- The sphere ----------

// Draws `map` onto a canvas as a lit sphere turned by `turn` radians, filling the canvas with a margin for the halo.
export class Globe {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.size = 0;
  }

  setMap(map) { this.map = map; }

  // Works out, for each pixel, where on the sphere it lands and how much light it gets. Redone only when the size changes.
  layout(size) {
    if (size === this.size) return;
    this.size = size;
    this.canvas.width = this.canvas.height = size;
    this.img = this.g.createImageData(size, size);
    const R = size * 0.4, c = size / 2;
    this.R = R;
    const L = norm([-0.62, 0.38, 0.69]); // light from the upper left, a little in front
    const px = [], lon = [], lat = [], sun = [], rim = [], view = [];
    const tilt = 0.18, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = (i + 0.5 - c) / R, y = (c - j - 0.5) / R;
        const d = x * x + y * y;
        if (d >= 1) continue;
        const z = Math.sqrt(1 - d);
        // Tip the spin axis a little toward the viewer's right.
        const xx = x * ct + y * st, yy = -x * st + y * ct;
        px.push(j * size + i);
        lon.push(Math.atan2(xx, z) / (Math.PI * 2));
        lat.push(Math.asin(clamp(yy, -1, 1)) / Math.PI);
        sun.push(x * L[0] + y * L[1] + z * L[2]);
        rim.push(1 - z);
        view.push(z);
      }
    }
    this.px = Int32Array.from(px);
    this.lon = Float32Array.from(lon);
    this.lat = Float32Array.from(lat);
    this.sun = Float32Array.from(sun);
    this.rim = Float32Array.from(rim);
    this.view = Float32Array.from(view);
  }

  draw(turn = 0, size = this.canvas.width || 256) {
    this.layout(size);
    const m = this.map;
    if (!m) return;
    const { g, img, px, lon, lat, sun, rim, view } = this;
    const data = img.data;
    data.fill(0);
    const { w, h, color, glow, cloud, look } = m;
    const atm = look.atm, atmK = look.atmK;
    const cc = look.cloud;
    const u0 = (turn / (Math.PI * 2)) * look.spin;
    const u1 = u0 * 1.25; // clouds drift a little faster than the ground
    const dark = !!look.dark;
    for (let k = 0; k < px.length; k++) {
      // Blend the four nearest texels, so coastlines and cloud edges stay smooth when the globe is big.
      const fv = Math.max(0, Math.min(h - 1.001, (0.5 - lat[k]) * h - 0.5));
      const v = fv | 0, v2 = v + 1 < h ? v + 1 : v, bv = fv - v;
      let uf = lon[k] + u0; uf -= Math.floor(uf);
      const fu = uf * w - 0.5 + w;
      const i0 = (fu | 0) % w, i1 = (i0 + 1) % w, bu = fu - Math.floor(fu);
      const t00 = v * w + i0, t01 = v * w + i1, t10 = v2 * w + i0, t11 = v2 * w + i1;
      const q00 = (1 - bu) * (1 - bv), q01 = bu * (1 - bv), q10 = (1 - bu) * bv, q11 = bu * bv;
      const t = q00 >= q01 && q00 >= q10 && q00 >= q11 ? t00 : q01 >= q10 && q01 >= q11 ? t01 : q10 >= q11 ? t10 : t11;
      const s = sun[k];
      // Soft terminator, and a little light from the night sky.
      let lit = dark ? 0.4 + 0.3 * Math.max(0, s) - 0.15 * rim[k] : smooth(-0.12, 0.6, s) * 1.05 + 0.025;
      if (look.gas) lit *= 0.75 + 0.25 * Math.pow(view[k], 0.5); // gas giants darken toward their edges
      let r = (color[t00 * 3] * q00 + color[t01 * 3] * q01 + color[t10 * 3] * q10 + color[t11 * 3] * q11) * lit;
      let gg = (color[t00 * 3 + 1] * q00 + color[t01 * 3 + 1] * q01 + color[t10 * 3 + 1] * q10 + color[t11 * 3 + 1] * q11) * lit;
      let b = (color[t00 * 3 + 2] * q00 + color[t01 * 3 + 2] * q01 + color[t10 * 3 + 2] * q10 + color[t11 * 3 + 2] * q11) * lit;
      if (cloud) {
        let uc = lon[k] + u1; uc -= Math.floor(uc);
        const fc = uc * w - 0.5 + w;
        const c0 = (fc | 0) % w, c1 = (c0 + 1) % w, bc = fc - Math.floor(fc);
        const a = ((cloud[v * w + c0] * (1 - bc) + cloud[v * w + c1] * bc) * (1 - bv) + (cloud[v2 * w + c0] * (1 - bc) + cloud[v2 * w + c1] * bc) * bv) / 255;
        const cl = lit * 1.05;
        r += (cc[0] * cl - r) * a; gg += (cc[1] * cl - gg) * a; b += (cc[2] * cl - b) * a;
      }
      if (glow) {
        // Its own light shows most on the night side, and through the day side when it's bright enough.
        const night = look.nightGlow ? 1 - smooth(-0.2, 0.4, s) * 0.6 : look.lava ? 1 : 1 - smooth(-0.1, 0.5, s) * 0.5;
        r += glow[t * 3] * night; gg += glow[t * 3 + 1] * night; b += glow[t * 3 + 2] * night;
      }
      if (atm) {
        const e = Math.pow(rim[k], 2.2) * atmK * (0.15 + 0.85 * smooth(-0.3, 0.6, s));
        r += (atm[0] - r) * Math.min(1, e); gg += (atm[1] - gg) * Math.min(1, e); b += (atm[2] - b) * Math.min(1, e);
      }
      const o = px[k] * 4;
      data[o] = r; data[o + 1] = gg; data[o + 2] = b;
      // Smooth the edge of the disc.
      data[o + 3] = rim[k] > 0.985 ? 255 * clamp((1 - rim[k]) / 0.015 * 0.9 + 0.1) : 255;
    }
    g.putImageData(img, 0, 0);
    // A halo of atmosphere outside the disc, brightest on the lit side.
    if (atm && atmK > 0) {
      const c = size / 2, R = this.R;
      g.save();
      g.globalCompositeOperation = 'destination-over';
      const grad = g.createRadialGradient(c - R * 0.12, c - R * 0.08, R * 0.95, c, c, R * 1.18);
      const a = Math.min(0.55, 0.3 * atmK);
      grad.addColorStop(0, `rgba(${atm[0]},${atm[1]},${atm[2]},${a})`);
      grad.addColorStop(1, `rgba(${atm[0]},${atm[1]},${atm[2]},0)`);
      g.fillStyle = grad;
      g.beginPath(); g.arc(c, c, R * 1.2, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
}

function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }

// A still picture of a world, for thumbnails: returns a canvas.
export function portrait(map, size, turn = 0.6) {
  const c = document.createElement('canvas');
  const globe = new Globe(c);
  globe.setMap(map);
  globe.draw(turn, size);
  return c;
}
