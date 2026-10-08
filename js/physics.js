// The numbers behind the bridge: how fast each warp factor is, how bright and how big a star looks from where
// you are, and how long a trip takes. Pure functions, so test/physics.test.mjs can check them without a browser.

export const LY_PER_PC = 3.26156;
export const AU_PER_PC = 206264.8;
export const SUN_RADIUS_AU = 0.00465047;
export const SUN_ABSMAG = 4.83;
export const SUN_TEMP = 5772;
const VOYAGER_AU_PER_YEAR = 3.6; // Voyager 1, about 17 km/s

// Warp factors on the 1980s-onward scale: speed = warp^(10/3) times light up to warp 9, then steeper toward 10.
const HIGH_WARP = [[9, 1516], [9.2, 1649], [9.6, 1909], [9.9, 3053], [9.99, 7912]];
export function warpSpeed(w) {
  if (w <= 9) return Math.pow(w, 10 / 3);
  for (let i = 1; i < HIGH_WARP.length; i++) {
    const [w0, v0] = HIGH_WARP[i - 1], [w1, v1] = HIGH_WARP[i];
    if (w <= w1) return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * (w - w0) / (w1 - w0));
  }
  return HIGH_WARP[HIGH_WARP.length - 1][1];
}

export const tripYears = (ly, warp) => ly / warpSpeed(warp);
export const voyagerYears = ly => ly * 63241.1 / VOYAGER_AU_PER_YEAR;

export function apparentMag(absmag, distPc) {
  return absmag + 5 * Math.log10(Math.max(distPc, 1e-12)) - 5;
}

// B-V colour index to surface temperature (Ballesteros 2012).
export function temperature(bv) {
  const b = Math.min(Math.max(bv, -0.4), 2.0);
  return 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
}

// Bolometric correction from temperature (Flower 1996, as corrected by Torres 2010).
export function bolometricCorrection(t) {
  const lt = Math.log10(Math.min(Math.max(t, 2400), 40000));
  let c;
  if (lt < 3.7) c = [-0.190537291496456e5, 0.155144866764412e5, -0.421278819301717e4, 0.381476328422343e3];
  else if (lt < 3.9) c = [-0.370510203809015e5, 0.385672629965804e5, -0.150651486316025e5, 0.261724637119416e4, -0.170623810323864e3];
  else c = [-0.118115450538963e6, 0.137145973583929e6, -0.636233812100225e5, 0.147412923562646e5, -0.170587278406872e4, 0.788731721804990e2];
  return c.reduce((sum, k, i) => sum + k * lt ** i, 0);
}

// Everything the log says about a star it has no notes on, worked out from its magnitude and colour.
export function physical(absmag, bv) {
  const t = temperature(bv);
  const lum = Math.pow(10, -0.4 * (absmag + bolometricCorrection(t) - 4.74));
  const radius = Math.sqrt(lum) * (SUN_TEMP / t) ** 2;
  return { temp: t, lum, radius };
}

// Star colour as the eye sees it: blackbody-ish, washed toward white (Tanner Helland's fit).
export function starColor(t) {
  const k = t / 100;
  let r, g, b;
  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    b = 255;
  }
  const c = [r, g, b].map(v => Math.min(Math.max(v, 0), 255) / 255);
  const m = Math.max(...c);
  return c.map(v => 0.45 + 0.55 * v / m);
}

// Where to hold the ship near a star: close enough that its disc looks about 2.5 degrees wide.
export function holdDistanceAU(radiusSun) {
  return Math.max(radiusSun * SUN_RADIUS_AU / Math.tan(1.25 * Math.PI / 180), 0.01);
}

export function formatDuration(years) {
  const hours = years * 8766;
  if (hours < 1 / 60) return 'under a minute';
  if (hours < 1) return plural(Math.round(hours * 60), 'minute');
  if (hours < 24) return plural(Math.round(hours), 'hour');
  const days = hours / 24;
  if (days < 2) { const h = Math.round(hours - 24); return h ? `1 day ${plural(h, 'hour')}` : '1 day'; }
  if (days < 60) return plural(Math.round(days), 'day');
  if (years < 2) return plural(Math.round(days / 30.44), 'month');
  if (years < 100) return plural(Math.round(years), 'year');
  return `${round(years).toLocaleString('en-US')} years`;
}

export function formatLy(ly) {
  if (ly < 0.01) {
    const au = ly * 63241.1;
    return `${au < 10 ? au.toFixed(2) : Math.round(au).toLocaleString('en-US')} AU`;
  }
  if (ly < 10) return `${ly.toFixed(2)} ly`;
  if (ly < 100) return `${ly.toFixed(1)} ly`;
  return `${Math.round(ly).toLocaleString('en-US')} ly`;
}

export function formatYear(year) {
  const y = Math.round(year);
  if (y <= 0) return `${(1 - y).toLocaleString('en-US')} BCE`;
  return String(y);
}

export function plural(n, word) {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

// Two significant figures, so 76,214 years reads as 76,000.
function round(x) {
  const p = Math.pow(10, Math.max(Math.floor(Math.log10(x)) - 1, 0));
  return Math.round(x / p) * p;
}

// Stardate, the bridge's way: the year plus how far through it we are.
export function stardate(date = new Date()) {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  return (y + (date.getTime() - start) / (end - start)).toFixed(3);
}
