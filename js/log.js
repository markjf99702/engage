// Writes the captain's log entry for an arrival: the star, its planets and notes, how home looks from here,
// and how the trip compares with light and with Voyager 1.
import {
  LY_PER_PC, apparentMag, formatDuration, formatLy, formatYear, stardate, tripYears, voyagerYears, SUN_ABSMAG,
} from './physics.js';
import { ANCHORS, DESTINATIONS } from './destinations.js';

const NOTES = new Map(DESTINATIONS.map(d => [d.star, d]));
const COLOUR = { O: 'Blue', B: 'Blue-white', A: 'White', F: 'Yellow-white', G: 'Yellow', K: 'Orange', M: 'Red' };

export const notesFor = (cat, i) => NOTES.get(cat.names[i]) || null;
export const titleFor = (cat, i) => notesFor(cat, i)?.title || cat.names[i];

// "Orange giant, spectral type K2III", from the catalogue's spectral type, or from the colour if it has none.
export function describeKind(spect, temp) {
  const s = (spect || '').trim();
  if (/^(D|wd)/i.test(s)) return `White dwarf, spectral type ${s}`;
  let letter = (s.match(/[OBAFGKM]/) || [])[0];
  if (!letter) letter = temp > 30000 ? 'O' : temp > 10000 ? 'B' : temp > 7500 ? 'A' : temp > 6000 ? 'F' : temp > 5200 ? 'G' : temp > 3700 ? 'K' : 'M';
  const lc = (s.match(/(Ia|Ib|III|II|IV|V|I)(?![a-z])/) || [])[1];
  const sub = /^sd/.test(s);
  let size;
  if (sub) size = 'subdwarf';
  else if (lc === 'III') size = 'giant';
  else if (lc === 'II') size = 'bright giant';
  else if (lc && lc.startsWith('I') && lc !== 'IV') size = 'supergiant';
  else if (lc === 'IV') size = 'subgiant';
  else size = 'GKM'.includes(letter) ? 'dwarf' : 'star';
  const what = `${COLOUR[letter]} ${size}`;
  return s ? `${what}, spectral type ${s}` : what;
}

function ratio(x, what) {
  if (x < 0.995) {
    const pct = x * 100;
    return `${pct < 1 ? pct.toPrecision(2) : Math.round(pct)}% of the Sun’s ${what}`;
  }
  if (x < 1.05) return `about the Sun’s ${what}`;
  const r = x < 10 ? x.toFixed(1).replace(/\.0$/, '') : Math.round(x).toLocaleString('en-US');
  return `${r} times the Sun’s ${what}`;
}

// How home looks from `cam` (parsecs from the Sun): the Sun's brightness and place, and Earth's old light.
export function homeLines(cat, cam, year = new Date().getUTCFullYear(), skip = -1) {
  const pc = Math.hypot(...cam);
  const ly = pc * LY_PER_PC;
  const m = apparentMag(SUN_ABSMAG, pc);
  const con = cat.constellationToward(cam.map(v => -v / pc));
  let rank = 1;
  for (let i = 1; i < cat.count; i++) {
    if (i === skip) continue;
    const d = cat.distanceFrom(i, cam);
    if (d > 0.01 && apparentMag(cat.absmag[i], d) < m) rank++;
  }
  const lines = [];
  const where = pc < 60 ? `in ${con}` : `in the part of the sky where Earth sees ${con}, though nothing around it would look familiar`;
  if (m < 6.5) {
    const place = rank <= 30 ? `, the ${ordinal(rank)} brightest star in this sky,` : '';
    lines.push(`The Sun is a magnitude ${m.toFixed(1)} star${place} ${where}.`);
  } else {
    lines.push(`The Sun is too faint to see without a telescope from here (magnitude ${m.toFixed(1)}), ${where}.`);
  }
  const seen = year - ly;
  const anchor = ANCHORS.find(([y]) => Math.abs(y - seen) <= (seen < 1500 ? 30 : 2));
  lines.push(`With a big enough telescope, someone here would see Earth as it was in ${formatYear(seen)}${anchor ? `, around when ${anchor[1]}` : ''}.`);
  const tv = 1936 + ly;
  lines.push(tv <= year
    ? `Earth’s radio and TV signals, leaking out since the 1930s, first passed here around ${formatYear(tv)}.`
    : `Earth’s first TV broadcasts, from 1936, won’t reach here until ${formatYear(tv)}.`);
  return lines;
}

export function tripLine(ly, warp, fromTitle) {
  const t = tripYears(ly, warp);
  const w = Number(warp).toFixed(1).replace(/\.0$/, '');
  return `${formatLy(ly)} from ${fromTitle} in ${formatDuration(t)} at warp ${w}. Light needs ${formatDuration(ly)} to cover that; Voyager 1 would need ${formatDuration(voyagerYears(ly))}.`;
}

// The full entry, as plain data so it can be kept in the log.
export function composeEntry(cat, i, { cam, holdAU, warp, fromTitle, tripLy, date = new Date() }) {
  const notes = notesFor(cat, i);
  const title = titleFor(cat, i);
  const fromSol = Math.hypot(...cat.pos.subarray(i * 3, i * 3 + 3)) * LY_PER_PC;
  const hold = notes?.hold?.label || `holding ${holdAU < 10 ? holdAU.toFixed(2) : Math.round(holdAU)} AU from the star`;
  const intro = i === 0
    ? `Back home, ${hold}.`
    : `We’ve dropped out of warp at ${title}, ${formatLy(fromSol)} from Sol, and are ${hold}.`;
  const sections = [];
  const kind = notes?.kind || describeKind(cat.spect[i], cat.temp[i]);
  const approx = notes ? '' : 'about ';
  const temp = `${(Math.round(cat.temp[i] / 10) * 10).toLocaleString('en-US')} K at the surface`;
  sections.push(['The star', i === 0
    ? `${kind}. ${temp}.`
    : `${kind}. ${temp}, ${approx}${ratio(cat.radius[i], 'width')}, and ${approx}${ratio(cat.lum[i], 'brightness').replace(/^about /, '')}.`]);
  if (notes?.planets) sections.push(['Planets', notes.planets]);
  for (const n of notes?.notes || []) sections.push(['', n]);
  if (notes?.fiction) sections.push(['In fiction', notes.fiction]);
  if (i !== 0) sections.push(['Looking home', homeLines(cat, cam, date.getUTCFullYear(), i).join(' ')]);
  if (tripLy > 0) sections.push(['The trip', tripLine(tripLy, warp, fromTitle)]);
  return { star: i, title, stardate: stardate(date), intro, sections, ly: tripLy || 0 };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
