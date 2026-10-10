// Tonight's sky: the real sky from where you're standing, with the stars Starfleet knows tagged on it.
// Hold the phone up and it follows where you point it (its compass and tilt sensors); without them, drag to look.
// Tap a tag to read it, then set course for it on the bridge.
import { loadCatalog } from './catalog.js';
import { DESTINATIONS } from './destinations.js';
import { describeKind, titleFor } from './log.js';
import { CHARTS } from './charts.js';
import { LY_PER_PC, apparentMag, formatLy, formatYear } from './physics.js';
import {
  jdOf, frame, toLocal, altAz, fromAltAz, sunDir, planetSky, moonSky, moonPhaseName, whereToLook, limitingMag, nextDark,
  phonePose, SKIES, NAKED_EYE_PLANETS,
} from './astro.js';

const KEY = 'engage.tonight.v1';
// Where Engage itself is. The single-file copy points this at the live site.
const BRIDGE = './';
const $ = id => document.getElementById(id);
const DEG = Math.PI / 180;
const DARK_SKY = 6.5; // the faintest star ever drawn
const PLANET_NAMES = { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };

// Cities to pick from when the phone can't say where it is, and for guessing from the time zone.
const CITIES = [
  ['New York', 40.71, -74.01, 'America/New_York'], ['Boston', 42.36, -71.06, 'America/New_York'], ['Washington', 38.91, -77.04, 'America/New_York'],
  ['Toronto', 43.65, -79.38, 'America/Toronto'], ['Chicago', 41.88, -87.63, 'America/Chicago'], ['Houston', 29.76, -95.37, 'America/Chicago'],
  ['Denver', 39.74, -104.99, 'America/Denver'], ['Phoenix', 33.45, -112.07, 'America/Phoenix'], ['Los Angeles', 34.05, -118.24, 'America/Los_Angeles'],
  ['San Francisco', 37.77, -122.42, 'America/Los_Angeles'], ['Seattle', 47.61, -122.33, 'America/Los_Angeles'], ['Vancouver', 49.28, -123.12, 'America/Vancouver'],
  ['Anchorage', 61.22, -149.9, 'America/Anchorage'], ['Honolulu', 21.31, -157.86, 'Pacific/Honolulu'], ['Mexico City', 19.43, -99.13, 'America/Mexico_City'],
  ['São Paulo', -23.55, -46.63, 'America/Sao_Paulo'], ['Buenos Aires', -34.6, -58.38, 'America/Argentina/Buenos_Aires'], ['Reykjavík', 64.15, -21.94, 'Atlantic/Reykjavik'],
  ['Dublin', 53.35, -6.26, 'Europe/Dublin'], ['London', 51.51, -0.13, 'Europe/London'], ['Paris', 48.86, 2.35, 'Europe/Paris'],
  ['Madrid', 40.42, -3.7, 'Europe/Madrid'], ['Berlin', 52.52, 13.4, 'Europe/Berlin'], ['Rome', 41.9, 12.5, 'Europe/Rome'],
  ['Stockholm', 59.33, 18.07, 'Europe/Stockholm'], ['Cairo', 30.04, 31.24, 'Africa/Cairo'], ['Nairobi', -1.29, 36.82, 'Africa/Nairobi'],
  ['Cape Town', -33.92, 18.42, 'Africa/Johannesburg'], ['Dubai', 25.2, 55.27, 'Asia/Dubai'], ['Mumbai', 19.08, 72.88, 'Asia/Kolkata'],
  ['Singapore', 1.35, 103.82, 'Asia/Singapore'], ['Hong Kong', 22.32, 114.17, 'Asia/Hong_Kong'], ['Tokyo', 35.68, 139.69, 'Asia/Tokyo'],
  ['Sydney', -33.87, 151.21, 'Australia/Sydney'], ['Melbourne', -37.81, 144.96, 'Australia/Melbourne'], ['Auckland', -36.85, 174.76, 'Pacific/Auckland'],
].map(([name, lat, lon, tz]) => ({ name, lat, lon, tz }));

const saved = load();
let cat, ctx, canvas;
let sky = null;          // everything worked out for the current place and moment
let view = { az: 180, alt: 35, fov: 80 * DEG };
let pose = null;         // where the phone is pointing, smoothed
let sensing = false, gotReading = false;
let compassOffset = null; // iPhones give alpha from wherever they started, and the compass separately
let offsetMin = 0;       // minutes ahead of now
let sel = null;          // { kind: 'star', i } | { kind: 'planet', name } | { kind: 'moon' } | { kind: 'sun' }
let dirty = true, aimAnim = null, testNow = null;
let placed = [];         // where things were drawn last frame, for taps: { x, y, r, hit }

function load() {
  try { return { sky: 'suburb', trim: 0, night: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { sky: 'suburb', trim: 0, night: false }; }
}
function save() {
  const { place, sky: s, trim, night } = saved;
  try { localStorage.setItem(KEY, JSON.stringify({ place, sky: s, trim, night })); } catch { /* fine */ }
}

// ---------- Startup ----------

async function start() {
  cat = await loadCatalog();
  canvas = $('view');
  ctx = canvas.getContext('2d');
  if (!saved.place) saved.place = guessPlace();
  prepareStars();
  buildSheets();
  document.body.classList.toggle('red', !!saved.night);
  $('night').setAttribute('aria-pressed', String(!!saved.night));
  compute();
  faceSomethingGood();
  bind();
  $('loading').remove();
  if (saved.place.how === 'guess' && navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') locate(); }).catch(() => {});
  }
  setInterval(() => { compute(); }, 20000);
  requestAnimationFrame(tick);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.tonight = hooks();
}

// The stars worth drawing (all the eye could ever see, from Earth), brightest first, and the tagged ones.
let bright, brightMag, tags;
function prepareStars() {
  const list = [];
  for (let i = 1; i < cat.count; i++) {
    const m = earthMag(i);
    if (m < DARK_SKY) list.push([i, m]);
  }
  list.sort((a, b) => a[1] - b[1]);
  bright = Int32Array.from(list, x => x[0]);
  brightMag = Float32Array.from(list, x => x[1]);

  const charted = new Map(CHARTS.map(c => [c.star, c]));
  tags = [];
  for (const c of CHARTS) {
    const i = cat.byName.get(c.star);
    if (i !== undefined) tags.push({ i, chart: c, name: c.tag });
  }
  for (const d of DESTINATIONS) {
    if (d.star === 'Sol' || charted.has(d.star)) continue;
    const i = cat.byName.get(d.star);
    if (i !== undefined) tags.push({ i, dest: d, name: d.title });
  }
  for (const t of tags) { t.mag = earthMag(t.i); t.ly = cat.distanceFrom(t.i, [0, 0, 0]) * LY_PER_PC; t.dest ??= DESTINATIONS.find(d => d.star === cat.names[t.i]); }
}
const earthMag = i => apparentMag(cat.absmag[i], cat.distanceFrom(i, [0, 0, 0]));
const starDir = i => [cat.pos[i * 3], cat.pos[i * 3 + 1], cat.pos[i * 3 + 2]];

// ---------- Where you are ----------

function guessPlace() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* none */ }
  const city = CITIES.find(c => c.tz === tz);
  if (city) return { name: city.name, lat: city.lat, lon: city.lon, tz, how: 'guess' };
  const lon = -new Date().getTimezoneOffset() / 4;
  const south = /^(Australia|Antarctica|Pacific\/(Auckland|Fiji)|America\/(Argentina|Santiago|Sao_Paulo|Montevideo))/.test(tz);
  return { name: 'your time zone', lat: south ? -33 : 40, lon, tz, how: 'guess' };
}

function setPlace(p) {
  saved.place = p;
  save();
  compute();
  renderPlaces();
}

function locate() {
  const note = $('place-note');
  if (!navigator.geolocation) { note.textContent = 'This browser can’t share its location. Pick the nearest city instead.'; return; }
  note.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
    const near = CITIES.map(c => [c, Math.hypot(c.lat - lat, (c.lon - lon) * Math.cos(lat * DEG))]).sort((a, b) => a[1] - b[1])[0];
    const name = near[1] < 1.2 ? `near ${near[0].name}` : `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}`;
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* none */ }
    setPlace({ name, lat, lon, tz, how: 'gps' });
    note.textContent = 'Using where your phone says you are, to about 10 km. It stays on this device.';
  }, err => {
    note.textContent = err.code === 1
      ? 'Location is turned off for this page. Pick the nearest city instead; within a few hundred kilometres the sky looks the same.'
      : 'Couldn’t get your location just now. Pick the nearest city instead.';
  }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
}

// ---------- Working out the sky ----------

const when = () => new Date((testNow ?? Date.now()) + offsetMin * 60000);

function compute() {
  const { lat, lon } = saved.place;
  const date = when(), jd = jdOf(date);
  const f = frame(lat, lon, jd);
  const sun = toLocal(f, sunDir(jd));
  const moon = moonSky(jd);
  const moonL = toLocal(f, moon.dir);
  const sunAlt = altAz(sun).alt, moonAlt = altAz(moonL).alt;
  const lim = limitingMag(saved.sky, sunAlt, moon.lit, moonAlt);
  const nightLim = limitingMag(saved.sky, -90, moon.lit, moonAlt);

  const n = bright.length;
  const local = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) local.set(toLocal(f, starDir(bright[k])), k * 3);
  const lines = cat.lines.map(([a, b]) => [toLocal(f, starDir(a)), toLocal(f, starDir(b))]);

  const planets = NAKED_EYE_PLANETS.map(name => {
    const p = planetSky(name, jd);
    return { name, label: PLANET_NAMES[name], local: toLocal(f, p.dir), mag: p.mag, au: p.au };
  });
  for (const t of tags) {
    t.local = toLocal(f, starDir(t.i));
    t.alt = altAz(t.local).alt;
    t.seen = t.mag <= nightLim;
  }
  sky = { date, f, sun, sunAlt, moon, moonL, moonAlt, lim, nightLim, local, lines, planets };
  updateHud();
  if (!$('list').hidden) renderList();
  if (!$('card').hidden && sel) showCard(sel);
  dirty = true;
}

function updateHud() {
  const p = saved.place;
  $('place-name').textContent = p.how === 'guess' && p.name !== 'your time zone' ? `Near ${p.name}?` : p.how === 'guess' ? 'Your time zone' : cap(p.name);
  $('clock').textContent = clockText(sky.date, offsetMin === 0);
  $('time-out').textContent = offsetMin === 0 ? 'Now' : timeOf(sky.date);
  $('time').style.setProperty('--fill', `${offsetMin / 7.2}%`);
  const day = sky.sunAlt > -2, twilight = !day && sky.sunAlt > -12;
  const banner = $('daylight');
  banner.hidden = !day && !twilight;
  if (!banner.hidden) {
    $('daylight-text').textContent = day
      ? 'The Sun’s up, so these stars are hidden in daylight for now. The tags show where they are.'
      : 'Still twilight: only the brightest stars are out so far.';
    const dark = nextDark(p.lat, p.lon, sky.date, 24);
    const mins = dark ? Math.ceil((dark - (testNow ?? Date.now())) / 600000) * 10 : null;
    $('go-dark').hidden = !(mins && mins <= 720);
    $('go-dark').dataset.min = mins ?? '';
    $('go-dark').textContent = dark ? `Show ${timeOf(dark)}` : 'Show tonight';
  }
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const timeOf = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tzOf() }).toLowerCase().replace(' ', ' ');
const clockText = (d, now) => `· ${now ? 'now, ' : ''}${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: tzOf() })} ${timeOf(d)}`;
function tzOf() {
  const tz = saved.place?.tz;
  try { if (tz) { Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } } catch { /* unknown zone */ }
  return undefined;
}

// Start by looking toward Vulcan if it's up, or the first other Starfleet star that is, or else the side of the
// sky away from the pole.
function faceSomethingGood() {
  const up = tags.filter(t => t.chart && t.alt > 12 && t.seen);
  const t = up.find(x => x.chart.tag === 'Vulcan') || up[0];
  if (t) {
    const { alt, az } = altAz(t.local);
    view.az = az; view.alt = Math.min(Math.max(alt, 20), 55);
  } else { view.az = saved.place.lat >= 0 ? 180 : 0; view.alt = 35; }
}

// ---------- Looking ----------

function basis() {
  if (sensing && pose) {
    const t = saved.trim * DEG, c = Math.cos(t), s = Math.sin(t);
    const turn = v => [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]]; // clockwise by the trim, seen from above
    return { f: turn(pose.forward), r: turn(pose.right), u: turn(pose.up) };
  }
  const f = fromAltAz(view.alt, view.az);
  const r = [Math.cos(view.az * DEG), -Math.sin(view.az * DEG), 0];
  const u = cross(r, f);
  return { f, r, u };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };

// A stereographic view, like a wide camera lens that keeps shapes true: `scale` is pixels per unit near the middle.
let B, W, H, S;
function project(d) {
  const z = dot(d, B.f);
  if (z < -0.5) return null;
  const k = 2 / (1 + z);
  return { x: W / 2 + k * dot(d, B.r) * S, y: H / 2 - k * dot(d, B.u) * S, z };
}

function tick() {
  if (aimAnim) stepAim();
  if (dirty && sky) { draw(); dirty = false; }
  requestAnimationFrame(tick);
}

function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = cw; H = ch;
  B = basis();
  S = Math.sqrt(W * H) / 2 / (2 * Math.tan(view.fov / 4));
  placed = [];
  // Keep labels clear of the header and the controls.
  const hud = document.querySelector('.hud').getBoundingClientRect(), controls = document.querySelector('.controls .row').getBoundingClientRect();
  labelBoxes = [{ x: -100, y: -100, w: W + 200, h: hud.bottom - 10 + 100 }, { x: controls.left, y: controls.top - 34, w: controls.width, h: H }];
  const zoom = Math.min(1.6, Math.max(0.8, Math.sqrt(80 * DEG / view.fov)));

  // The sky's colour from where the Sun is.
  const sa = sky.sunAlt;
  const glow = Math.min(1, Math.max(0, (sa + 15) / 17));
  const top = mix([3, 5, 12], [40, 92, 160], glow), low = mix([8, 12, 26], [120, 160, 210], glow);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(low));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const lim = sky.lim, ghost = sky.lim < sky.nightLim - 0.5; // daylight or twilight: draw the night's stars faintly
  const drawLim = ghost ? Math.min(sky.nightLim, 4.5) : lim;

  // Constellation lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(134, 190, 255, ${ghost ? 0.12 : 0.2})`;
  ctx.beginPath();
  for (const [a, b] of sky.lines) {
    if (a[2] < 0 && b[2] < 0) continue;
    const pa = project(a), pb = project(b);
    if (!pa || !pb || pa.z < 0 || pb.z < 0) continue;
    ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();

  // Stars
  const L = sky.local;
  for (let k = 0; k < bright.length; k++) {
    const m = brightMag[k];
    if (m > drawLim + 0.4) break;
    if (L[k * 3 + 2] < -0.02) continue;
    const p = project([L[k * 3], L[k * 3 + 1], L[k * 3 + 2]]);
    if (!p || p.x < -8 || p.y < -8 || p.x > W + 8 || p.y > H + 8) continue;
    const s = drawLim + 0.4 - m;
    let a = Math.min(1, s / 1.4);
    if (ghost) a *= sky.sunAlt > -2 ? 0.8 : 0.5;
    const r = Math.min(4.6, 0.55 + s * 0.42) * zoom;
    const i = bright[k];
    const c = cat.color.subarray(i * 3, i * 3 + 3);
    ctx.fillStyle = `rgba(${c[0] * 255 | 0}, ${c[1] * 255 | 0}, ${c[2] * 255 | 0}, ${a})`;
    if (r < 1.1) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
    if (m < 2.2) placed.push({ x: p.x, y: p.y, r: 16, hit: { kind: 'star', i }, rank: m });
  }

  // Planets, the Moon and the Sun
  for (const pl of sky.planets) {
    if (pl.local[2] < -0.02 || pl.mag > Math.max(lim, 2)) continue;
    const p = project(pl.local);
    if (!p || p.z < 0) continue;
    const r = Math.min(5, 1.6 + (2 - pl.mag) * 0.6) * zoom;
    ctx.fillStyle = '#ffe9c4';
    ctx.shadowColor = 'rgba(255, 200, 120, 0.8)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    label(pl.label, p.x, p.y, r + 6, 'planet');
    placed.push({ x: p.x, y: p.y, r: 22, hit: { kind: 'planet', name: pl.name }, rank: -5 });
  }
  if (sky.moonL[2] > -0.02) drawMoon();
  if (sky.sun[2] > -0.02) {
    const p = project(sky.sun);
    if (p && p.z > 0) {
      const sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 60);
      sg.addColorStop(0, 'rgba(255, 250, 230, 1)'); sg.addColorStop(0.15, 'rgba(255, 235, 180, 0.9)'); sg.addColorStop(1, 'rgba(255, 220, 160, 0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(p.x, p.y, 60, 0, 7); ctx.fill();
      placed.push({ x: p.x, y: p.y, r: 30, hit: { kind: 'sun' }, rank: -30 });
    }
  }

  drawGround();

  // The tags: Starfleet's names, then Engage's other destinations.
  for (const t of tags) drawTag(t);

  // Bright stars' own names, small, where there's room.
  for (const q of placed) {
    if (q.hit.kind !== 'star' || q.rank > 1.4 || tags.some(t => t.i === q.hit.i)) continue;
    const name = cat.names[q.hit.i];
    if (/^(HIP|Gliese|HD) /.test(name)) continue;
    label(name, q.x, q.y, 6, 'star');
  }

  drawSelection();
  drawPointer();
}

const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const rgb = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;

// The ground, below the horizon. On this kind of view the horizon is always a circle (or a straight line),
// so it's found from three points on it, and the ground is whichever side the point under your feet is on.
function drawGround() {
  const az0 = Math.atan2(B.f[0], B.f[1]) / DEG;
  const pts = [0, 90, -90].map(d => project(fromAltAz(0, az0 + d)));
  if (pts.some(p => !p)) return;
  const [p1, p2, p3] = pts;
  const nadir = project([0, 0, -1]);
  ctx.save();
  ctx.beginPath();
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  let horizon;
  if (Math.abs(d) < 1e-3) {
    // A straight horizon: fill the half of the screen the nadir is on.
    const dx = p3.x - p2.x, dy = p3.y - p2.y, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    const ref = nadir || { x: W / 2 - B.u[0], y: H }; // looking straight out, the ground is down the screen
    if ((ref.x - p2.x) * nx + (ref.y - p2.y) * ny < 0) { nx = -nx; ny = -ny; }
    const far = 4 * (W + H);
    ctx.moveTo(p2.x - dx / len * far, p2.y - dy / len * far);
    ctx.lineTo(p2.x + dx / len * far, p2.y + dy / len * far);
    ctx.lineTo(p2.x + dx / len * far + nx * far, p2.y + dy / len * far + ny * far);
    ctx.lineTo(p2.x - dx / len * far + nx * far, p2.y - dy / len * far + ny * far);
    ctx.closePath();
    horizon = () => { ctx.moveTo(p2.x - dx / len * far, p2.y - dy / len * far); ctx.lineTo(p2.x + dx / len * far, p2.y + dy / len * far); };
  } else {
    const a1 = p1.x * p1.x + p1.y * p1.y, a2 = p2.x * p2.x + p2.y * p2.y, a3 = p3.x * p3.x + p3.y * p3.y;
    const cx = (a1 * (p2.y - p3.y) + a2 * (p3.y - p1.y) + a3 * (p1.y - p2.y)) / d;
    const cy = (a1 * (p3.x - p2.x) + a2 * (p1.x - p3.x) + a3 * (p2.x - p1.x)) / d;
    const r = Math.hypot(p1.x - cx, p1.y - cy);
    const inside = nadir ? Math.hypot(nadir.x - cx, nadir.y - cy) < r : false;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (!inside) ctx.rect(-10, -10, W + 20, H + 20);
    horizon = () => ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  const glow = Math.min(1, Math.max(0, (sky.sunAlt + 15) / 17));
  ctx.fillStyle = `rgba(${mix([6, 9, 12], [34, 44, 40], glow).join(',')}, 0.94)`;
  ctx.fill('evenodd');
  ctx.beginPath(); horizon();
  ctx.strokeStyle = 'rgba(255, 181, 74, 0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();

  // Compass points along the horizon
  ctx.textAlign = 'center';
  for (const [az, name] of [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']]) {
    const p = project(fromAltAz(0, az));
    if (!p || p.z < 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
    ctx.font = `600 ${name.length === 1 ? 15 : 11}px ${FONT}`;
    ctx.fillStyle = name.length === 1 ? '#ffb54a' : 'rgba(255, 181, 74, 0.7)';
    ctx.fillText(name, p.x, p.y + 18);
    labelBoxes.push({ x: p.x - 12, y: p.y + 4, w: 24, h: 18 });
  }
  ctx.textAlign = 'left';
}

function drawMoon() {
  const p = project(sky.moonL);
  if (!p || p.z < 0) return;
  const r = Math.max(7, 0.26 * DEG * S * 2 / (1 + p.z));
  // Which way the Sun is, on screen
  const toward = sky.moonL.map((v, k) => v + 0.02 * sky.sun[k]);
  const q = project(toward) || { x: p.x + 1, y: p.y };
  const ang = Math.atan2(q.y - p.y, q.x - p.x);
  const { lit } = sky.moon;
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(60, 66, 80, 0.85)';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  ctx.shadowColor = 'rgba(255, 250, 230, 0.6)'; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); // the half facing the Sun…
  const w = r * Math.abs(1 - 2 * lit);       // …and the terminator, an ellipse
  ctx.ellipse(0, 0, w, r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5);
  ctx.fill();
  ctx.restore();
  label('Moon', p.x, p.y, r + 6, 'planet');
  placed.push({ x: p.x, y: p.y, r: Math.max(24, r), hit: { kind: 'moon' }, rank: -12 });
}

const FONT = "'Chakra Petch', 'Avenir Next Condensed', 'Arial Narrow', sans-serif";
let labelBoxes = [];
function label(text, x, y, gap, style) {
  ctx.font = `${style === 'star' ? 500 : 600} ${style === 'star' ? 11 : 12}px ${FONT}`;
  const w = ctx.measureText(text).width;
  const box = { x: x + gap, y: y - 8, w, h: 14 };
  if (overlaps(box)) return;
  labelBoxes.push(box);
  ctx.fillStyle = style === 'planet' ? '#ffd28a' : 'rgba(200, 210, 230, 0.62)';
  ctx.fillText(text, x + gap, y + 4);
}
const overlaps = b => labelBoxes.some(o => b.x < o.x + o.w + 4 && o.x < b.x + b.w + 4 && b.y < o.y + o.h && o.y < b.y + b.h);

// A Starfleet tag: a targeting ring on the star, its name and a line under it.
function drawTag(t) {
  const p = project(t.local);
  if (!p || p.z < 0.05 || p.x < -60 || p.x > W + 60 || p.y < -40 || p.y > H + 40) return;
  const below = t.alt < 0, faint = !t.seen;
  const trek = !!t.chart;
  if (below && !trek && !(sel?.kind === 'star' && sel.i === t.i)) return; // only Starfleet's are worth looking down for
  const color = trek ? '134, 216, 255' : '255, 181, 74';
  const a = below ? 0.4 : 1;
  const R = trek ? 12 : 9;
  ctx.save();
  ctx.strokeStyle = `rgba(${color}, ${0.9 * a})`;
  ctx.lineWidth = 1.4;
  if (faint) ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  if (trek) {
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(p.x + dx * (R + 2), p.y + dy * (R + 2)); ctx.lineTo(p.x + dx * (R + 7), p.y + dy * (R + 7)); }
    ctx.stroke();
  }
  // The name, with a dark pill behind it so it reads over anything.
  const sub = below ? 'below the horizon' : faint ? 'too faint to see' : t.chart ? `${titleFor(cat, t.i)} · ${formatLy(t.ly)}` : formatLy(t.ly);
  ctx.font = `600 ${trek ? 14 : 12}px ${FONT}`;
  const name = trek ? t.name.toUpperCase() : t.name;
  const wName = ctx.measureText(name).width + (trek ? name.length * 1.2 : 0);
  ctx.font = `500 11px ${FONT}`;
  const wSub = ctx.measureText(sub).width;
  const w = Math.max(wName, wSub) + 14, h = 34;
  let x = p.x + R + 9, y = p.y - h / 2;
  if (x + w > W - 6 || overlaps({ x, y, w, h })) x = p.x - R - 9 - w;
  const box = { x, y, w, h };
  const reserved = labelBoxes.slice(0, 2); // the header and the controls: never under those
  if (reserved.some(o => box.x < o.x + o.w && o.x < box.x + box.w && box.y < o.y + o.h && o.y < box.y + box.h) || (overlaps(box) && !trek)) { ctx.restore(); placed.push({ x: p.x, y: p.y, r: 20, hit: { kind: 'star', i: t.i }, rank: -20 }); return; }
  labelBoxes.push(box);
  ctx.fillStyle = `rgba(5, 9, 18, ${0.72 * a})`;
  roundRect(x, y, w, h, 7); ctx.fill();
  ctx.fillStyle = `rgba(${color}, ${a})`;
  ctx.fillRect(x, y + 5, 2, h - 10);
  ctx.font = `600 ${trek ? 14 : 12}px ${FONT}`;
  if (trek && 'letterSpacing' in ctx) ctx.letterSpacing = '1.2px';
  ctx.fillText(name, x + 8, y + 15);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `500 11px ${FONT}`;
  ctx.fillStyle = `rgba(200, 210, 230, ${0.85 * a})`;
  ctx.fillText(sub, x + 8, y + 28);
  ctx.restore();
  placed.push({ x: p.x, y: p.y, r: 26, box, hit: { kind: 'star', i: t.i }, rank: trek ? -40 : -20 });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Where the selected thing is in your local sky.
function selLocal(s = sel) {
  if (!s) return null;
  if (s.kind === 'star') return toLocal(sky.f, starDir(s.i));
  if (s.kind === 'planet') return sky.planets.find(p => p.name === s.name).local;
  if (s.kind === 'moon') return sky.moonL;
  return sky.sun;
}

function drawSelection() {
  if (!sel) return;
  const p = project(selLocal());
  if (!p || p.z < 0) return;
  ctx.strokeStyle = '#ffb54a'; ctx.lineWidth = 1.6;
  const R = 19, k = 6;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.moveTo(p.x + sx * R, p.y + sy * (R - k)); ctx.lineTo(p.x + sx * R, p.y + sy * R); ctx.lineTo(p.x + sx * (R - k), p.y + sy * R);
  }
  ctx.stroke();
}

// When the selected thing is off the screen, an arrow at the edge says which way to turn.
function drawPointer() {
  const el = $('pointer');
  if (!sel) { el.hidden = true; return; }
  const d = selLocal();
  const z = dot(d, B.f), x = dot(d, B.r), y = dot(d, B.u);
  const p = project(d);
  const on = p && p.z > 0 && p.x > 20 && p.x < W - 20 && p.y > 90 && p.y < H - 150;
  el.hidden = on;
  if (on) return;
  const ang = Math.atan2(-y, z < -0.999 ? 1 : x); // screen angle, y down
  const cx = W / 2, cy = (90 + H - 150) / 2, hw = W / 2 - 34, hh = (H - 150 - 90) / 2 - 10;
  const t = Math.min(hw / Math.abs(Math.cos(ang) || 1e-9), hh / Math.abs(Math.sin(ang) || 1e-9));
  el.style.transform = `translate(${cx + Math.cos(ang) * t}px, ${cy + Math.sin(ang) * t}px)`;
  el.querySelector('svg').style.transform = `rotate(${ang}rad)`;
  $('pointer-name').textContent = nameOf(sel);
}

function nameOf(s) {
  if (s.kind === 'star') { const t = tags.find(x => x.i === s.i); return t ? t.name : titleFor(cat, s.i); }
  if (s.kind === 'planet') return PLANET_NAMES[s.name];
  return s.kind === 'moon' ? 'The Moon' : 'The Sun';
}

// ---------- The card ----------

function showCard(s) {
  sel = s;
  const local = selLocal(s);
  const pos = altAz(local);
  const look = whereToLook(pos);
  const course = $('card-course');
  course.hidden = s.kind !== 'star';
  let kind, title, sub = '', line = '', facts = '', seeIt = '';
  const skyName = SKIES[saved.sky].label.toLowerCase();
  const night = sky.sunAlt > -12 ? ' once it’s dark' : '';
  if (s.kind === 'star') {
    const t = tags.find(x => x.i === s.i);
    const ly = cat.distanceFrom(s.i, [0, 0, 0]) * LY_PER_PC;
    const m = earthMag(s.i);
    const d = t?.dest;
    kind = t?.chart ? 'Starfleet charts' : d ? 'Engage destination' : 'Star';
    title = t ? t.name : titleFor(cat, s.i);
    sub = [t?.chart && titleFor(cat, s.i) !== title ? titleFor(cat, s.i) : '', `${formatLy(ly)} away`].filter(Boolean).join(' · ');
    line = t?.chart?.line || d?.fiction || d?.notes?.[0] || '';
    seeIt = m <= sky.nightLim
      ? `You can see it from the ${skyName}${night}.`
      : m < 6.5 ? `Too faint to pick out from the ${skyName}; it needs a dark sky.` : `Far too faint to see without a telescope (magnitude ${m.toFixed(1)}).`;
    const left = new Date().getFullYear() - ly;
    facts = `${d?.kind || describeKind(cat.spect[s.i], cat.temp[s.i])}. The light reaching you tonight left it ${ly < 5000 ? `in ${formatYear(left)}` : `about ${formatLy(ly).replace(' ly', '')} years ago`}.`;
    course.href = `${BRIDGE}?course=${encodeURIComponent(cat.names[s.i])}`;
    course.textContent = `Set course for ${titleFor(cat, s.i)}`;
    if (BRIDGE.startsWith('http')) { course.target = '_blank'; course.rel = 'noopener'; }
  } else if (s.kind === 'planet') {
    const p = sky.planets.find(x => x.name === s.name);
    kind = 'Planet'; title = PLANET_NAMES[s.name];
    const mins = p.au * 499 / 60;
    sub = `${p.au.toFixed(2)} AU away`;
    line = `It shines at magnitude ${p.mag.toFixed(1)}, ${p.mag < 0 ? 'brighter than almost every star' : 'as bright as a fairly bright star'}, and doesn’t twinkle the way stars do.`;
    facts = `Its light takes ${mins < 60 ? `${Math.round(mins)} minutes` : `${(mins / 60).toFixed(1)} hours`} to reach you.`;
  } else if (s.kind === 'moon') {
    kind = 'The Moon'; title = moonPhaseName(sky.moon.lit, sky.moon.waxing);
    sub = `${Math.round(sky.moon.lit * 100)}% lit · ${Math.round(sky.moon.km).toLocaleString('en-US')} km away`;
    line = sky.moon.lit > 0.6 ? 'A bright moon washes out the faintest stars, so fewer of the tags are visible tonight.' : 'A thin moon leaves the sky dark for the faint stars.';
    facts = 'Its light takes 1.3 seconds to reach you.';
  } else {
    kind = 'Sol'; title = 'The Sun'; sub = '8 light minutes away';
    line = 'Home. Don’t look straight at it.';
  }
  $('card-kind').textContent = kind;
  $('card-title').textContent = title;
  $('card-sub').textContent = sub;
  $('card-look').textContent = `${cap(look)}${s.kind === 'star' && pos.alt > -0.5 ? '. ' + seeIt : '.'}`;
  $('card-line').textContent = line;
  $('card-line').hidden = !line;
  $('card-facts').textContent = facts;
  $('card-facts').hidden = !facts;
  openSheet('card');
  frameAboveCard();
  dirty = true;
}

// With the card up, turn the view (when looking by hand) so the thing sits in the sky that's left above it.
function frameAboveCard() {
  if (sensing || !sel || !B) return;
  const card = $('card').getBoundingClientRect();
  const free = card.left > W / 2 ? { x: card.left / 2, y: H / 2 } : { x: W / 2, y: Math.max(110, (card.top + 80) / 2) };
  const p = project(selLocal());
  if (p && p.z > 0 && Math.abs(p.x - free.x) < W * 0.4 && p.y > 90 && p.y < card.top - 30 && card.left <= W / 2) return;
  aim(sel, (H / 2 - free.y) / S / DEG, card.left > W / 2 ? (W / 2 - free.x) / S / DEG : 0);
}

// ---------- The list ----------

function renderList() {
  const rows = tags.map(t => ({ t, state: t.alt < 0 ? 2 : t.seen ? 0 : 1 }))
    .sort((a, b) => a.state - b.state || (b.t.chart ? 1 : 0) - (a.t.chart ? 1 : 0) || b.t.alt - a.t.alt);
  const up = rows.filter(r => r.state === 0 && r.t.chart).length;
  const charted = tags.filter(t => t.chart).length;
  $('list-note').textContent = `${up} of Starfleet’s ${charted} charted stars ${up === 1 ? 'is' : 'are'} up and bright enough to see from the ${SKIES[saved.sky].label.toLowerCase()}${sky.sunAlt > -12 ? ' once it’s dark' : ''}.`;
  const box = $('systems');
  box.replaceChildren(...rows.map(({ t, state }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `system s${state}${t.chart ? ' trek' : ''}`;
    const where = state === 2 ? 'Below the horizon' : `${cap(whereToLook(altAz(t.local)))}${state === 1 ? ', too faint to see' : ''}`;
    b.innerHTML = '<i aria-hidden="true"></i><span class="s-name"></span><span class="s-sub"></span>';
    b.querySelector('.s-name').textContent = t.name;
    b.querySelector('.s-sub').textContent = `${t.chart && titleFor(cat, t.i) !== t.name ? titleFor(cat, t.i) + ' · ' : ''}${where}`;
    b.addEventListener('click', () => { const s = { kind: 'star', i: t.i }; showCard(s); if (sensing) aim(s); });
    return b;
  }));
}

// Turn the view to something (when looking by hand; with the sensors, the arrow at the edge says where to point).
// `up` and `left` (degrees) put it above or left of the middle of the screen.
function aim(s, up = 0, left = 0) {
  sel = s;
  if (sensing) { dirty = true; return; }
  const { alt, az } = altAz(selLocal(s));
  const to = Math.min(Math.max(alt - up, -10), 80);
  const daz = ((az + left / Math.max(0.3, Math.cos(alt * DEG)) - view.az + 540) % 360) - 180;
  aimAnim = { from: { az: view.az, alt: view.alt }, daz, to, t0: performance.now() };
}
function stepAim() {
  const k = Math.min(1, (performance.now() - aimAnim.t0) / 900), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  view.az = (aimAnim.from.az + aimAnim.daz * e + 360) % 360;
  view.alt = aimAnim.from.alt + (aimAnim.to - aimAnim.from.alt) * e;
  if (k >= 1) aimAnim = null;
  dirty = true;
}

// ---------- Places sheet ----------

function buildSheets() {
  const skies = $('skies');
  for (const [id, s] of Object.entries(SKIES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sky-opt'; b.dataset.id = id; b.setAttribute('role', 'radio');
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = s.label;
    b.querySelector('span').textContent = s.note;
    b.addEventListener('click', () => { saved.sky = id; save(); compute(); renderPlaces(); });
    skies.append(b);
  }
  const cities = $('cities');
  for (const c of CITIES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'city'; b.textContent = c.name;
    b.addEventListener('click', () => {
      setPlace({ name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, how: 'city' });
      $('place-note').textContent = '';
      closeSheets();
    });
    cities.append(b);
  }
  renderPlaces();
}

function renderPlaces() {
  for (const b of $('skies').children) b.setAttribute('aria-checked', String(b.dataset.id === saved.sky));
  for (const b of $('cities').children) b.setAttribute('aria-pressed', String(saved.place.how === 'city' && b.textContent === saved.place.name));
  if (!$('place-note').textContent) {
    $('place-note').textContent = saved.place.how === 'guess'
      ? 'Guessed from your time zone. Share your location, or pick the nearest city, for a sky that lines up.'
      : saved.place.how === 'gps' ? 'Using where your phone says you are, to about 10 km. It stays on this device.' : '';
  }
}

// ---------- Sheets ----------

function openSheet(id) {
  for (const s of ['card', 'list', 'places']) if (s !== id) $(s).hidden = true;
  $(id).hidden = false;
  $('scrim').hidden = id === 'card'; // the card leaves the sky usable behind it
  document.body.classList.toggle('carded', id === 'card');
}
function closeSheets() {
  for (const s of ['card', 'list', 'places']) $(s).hidden = true;
  $('scrim').hidden = true;
  document.body.classList.remove('carded');
  sel = null;
  dirty = true;
}

// ---------- Sensors ----------

const touchy = matchMedia('(pointer: coarse)').matches;

async function toggleSensors() {
  if (sensing) { stopSensors(); return; }
  if (typeof DeviceOrientationEvent === 'undefined') { noSensors(); return; }
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') { hint('Motion access is off, so drag to look around instead. You can turn it on in Settings for this site.'); return; }
    } catch { noSensors(); return; }
  }
  sensing = true; gotReading = false; compassOffset = null; pose = null;
  window.addEventListener('deviceorientationabsolute', onAbsolute);
  window.addEventListener('deviceorientation', onOrient);
  $('sensors').textContent = 'Stop';
  $('sensors').classList.replace('primary', 'secondary');
  hint('Hold your phone up to the sky. If the stars sit a little off, drag sideways to line them up.');
  setTimeout(() => { if (sensing && !gotReading) { stopSensors(); noSensors(); } }, 2500);
}

function stopSensors() {
  sensing = false;
  window.removeEventListener('deviceorientationabsolute', onAbsolute);
  window.removeEventListener('deviceorientation', onOrient);
  if (pose) { const { alt, az } = altAz(basis().f); view.alt = alt; view.az = az; }
  pose = null;
  $('sensors').textContent = 'Point your phone';
  $('sensors').classList.replace('secondary', 'primary');
  hint('Drag to look around. Tap a tag to read it.');
  dirty = true;
}

function noSensors() {
  hint('This device isn’t sharing its compass and tilt, so drag to look around instead.');
  $('sensors').hidden = true;
}

let absolute = false;
function onAbsolute(e) { if (e.alpha != null) { absolute = true; reading(e.alpha, e); } }
function onOrient(e) {
  if (e.alpha == null || e.beta == null) return;
  if (absolute) return; // Android sends both; the absolute one is already in hand
  let alpha = e.alpha;
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
    // iPhone: alpha starts wherever the phone was; the compass heading says where north is.
    const off = ((360 - e.webkitCompassHeading - e.alpha) % 360 + 360) % 360;
    compassOffset = compassOffset == null ? off : compassOffset + (((off - compassOffset + 540) % 360) - 180) * 0.05;
    alpha = e.alpha + compassOffset;
  } else if (!e.absolute && !gotReading) hint('This phone’s compass isn’t reporting north, so drag sideways to line the stars up.');
  reading(alpha, e);
}

function reading(alpha, e) {
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  const p = phonePose(alpha, e.beta, e.gamma, angle);
  gotReading = true;
  if (!pose) pose = p;
  else {
    const k = 0.25;
    const f = norm(pose.forward.map((v, i) => v + (p.forward[i] - v) * k));
    const u0 = pose.up.map((v, i) => v + (p.up[i] - v) * k);
    const r = norm(cross(f, u0));
    pose = { forward: f, right: r, up: cross(r, f) };
  }
  dirty = true;
}

function hint(text) { $('hint').textContent = text; }

// ---------- Input ----------

function bind() {
  window.addEventListener('resize', () => { dirty = true; });
  $('sensors').hidden = !touchy;
  $('sensors').addEventListener('click', toggleSensors);
  $('time').addEventListener('input', e => { offsetMin = +e.target.value; compute(); });
  $('go-dark').addEventListener('click', e => {
    offsetMin = Math.min(720, +e.currentTarget.dataset.min);
    $('time').value = offsetMin;
    compute();
  });
  $('open-place').addEventListener('click', () => openSheet('places'));
  $('open-list').addEventListener('click', () => { renderList(); openSheet('list'); });
  $('locate').addEventListener('click', locate);
  $('night').addEventListener('click', () => {
    saved.night = !saved.night; save();
    document.body.classList.toggle('red', saved.night);
    $('night').setAttribute('aria-pressed', String(saved.night));
  });
  $('scrim').addEventListener('click', closeSheets);
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closeSheets);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheets();
    if (e.target.tagName === 'INPUT' || sensing) return;
    const step = view.fov / DEG / 12;
    const keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (keys[e.key]) { e.preventDefault(); view.az = (view.az + keys[e.key][0] + 360) % 360; view.alt = clampAlt(view.alt + keys[e.key][1]); dirty = true; }
  });

  // Drag to look (or, with the sensors on, to correct the compass), pinch or scroll to zoom, tap to pick.
  const pts = new Map();
  let start = null, moved = false, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { start = [e.clientX, e.clientY]; moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), fov: view.fov }; moved = true; }
    aimAnim = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const last = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      view.fov = clampFov(pinch.fov * pinch.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])));
      dirty = true; return;
    }
    if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) moved = true;
    if (!moved) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    if (sensing) { saved.trim = ((saved.trim - dx / S / DEG) % 360 + 540) % 360 - 180; }
    else { view.az = (view.az - dx / S / DEG + 360) % 360; view.alt = clampAlt(view.alt + dy / S / DEG); }
    dirty = true;
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) {
      if (!moved) tap(e.clientX, e.clientY);
      else if (sensing) save();
      start = null;
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.fov = clampFov(view.fov * Math.exp(e.deltaY * 0.0012)); dirty = true; }, { passive: false });
}

const clampAlt = a => Math.max(-85, Math.min(89, a));
const clampFov = f => Math.max(18 * DEG, Math.min(120 * DEG, f));

function tap(x, y) {
  const r = canvas.getBoundingClientRect();
  x -= r.left; y -= r.top;
  let best = null, score = Infinity;
  for (const q of placed) {
    const inBox = q.box && x >= q.box.x && x <= q.box.x + q.box.w && y >= q.box.y && y <= q.box.y + q.box.h;
    const d = inBox ? 0 : Math.hypot(q.x - x, q.y - y);
    if (d > q.r) continue;
    const s = d + q.rank * 0.5;
    if (s < score) { score = s; best = q; }
  }
  if (best) showCard(best.hit);
  else if (!$('card').hidden) closeSheets();
}

// ---------- For tests and screenshots ----------

function hooks() {
  return {
    get state() { return { view: { ...view }, place: saved.place, offsetMin, sensing, trim: saved.trim, sel, sunAlt: sky.sunAlt }; },
    at(iso) { testNow = +new Date(iso); compute(); },
    place(lat, lon, name, tz) { setPlace({ name, lat, lon, tz, how: 'city' }); },
    look(az, alt, fovDeg) { view.az = az; view.alt = alt; if (fovDeg) view.fov = fovDeg * DEG; aimAnim = null; dirty = true; },
    aimAt(name) { const t = tags.find(x => x.name === name || cat.names[x.i] === name); const s = { kind: 'star', i: t ? t.i : cat.byName.get(name) }; aim(s); aimAnim = null; const { alt, az } = altAz(selLocal(s)); view.az = az; view.alt = Math.min(Math.max(alt, -10), 80); dirty = true; },
    // Where a named star lands on screen, in CSS pixels.
    where(name) { const t = tags.find(x => x.name === name); const i = t ? t.i : cat.byName.get(name); B = basis(); return project(toLocal(sky.f, starDir(i))); },
    tag(name) { const t = tags.find(x => x.name === name); return t && { alt: t.alt, seen: t.seen, mag: t.mag }; },
    // Pretend to be a phone held up: compass heading and tilt.
    sense(alpha, beta, gamma) { sensing = true; gotReading = true; pose = null; reading(alpha, { beta, gamma }); },
    unsense() { stopSensors(); },
    pointing() { return altAz(basis().f); },
  };
}

start().catch(e => { $('loading').textContent = 'Couldn’t chart the sky. Try reloading.'; throw e; });
