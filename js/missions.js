// Long missions: where the Voyagers, New Horizons, Webb and the Pioneers are right now, on a map and in numbers,
// with a hail you can send and watch crawl out to them at the speed of light.
import { SHIPS, byId } from './ships.js';
import {
  AU_KM, LIGHT_DAY_AU, jdOf, dateOf, readings, trackUntil, planetAt, earthAt, semiMajor,
  jwstFromEarth, jwstSpan, moonAt, whenAbove,
} from './ephemeris.js';
import { warpSpeed, stardate, plural } from './physics.js';

const KEY = 'engage.missions.v1';
// Where Engage itself is. The single-file copy points this at the live site.
const BRIDGE = './';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const still = matchMedia('(prefers-reduced-motion: reduce)');

const saved = load();
let sel = byId(location.hash.slice(1)) ? location.hash.slice(1) : 'v1';
let view = byId(sel).near ? 'earth' : 'sun';
let lastText = 0;
let next = null; // the selected ship's next milestone: { jd, text }

function load() {
  try { return { hails: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { hails: {} }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* fine */ } }

// ---------- Words for numbers ----------

const int = x => Math.round(x).toLocaleString('en-US');
const fmtDate = (d, opts = {}) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', ...opts });
const fmtWhen = d => {
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  const days = (d - Date.now()) / 864e5;
  if (days > 0 && days < 6) return `${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${time}`;
};
function lightTime(sec) {
  if (sec < 60) return `${sec.toFixed(1)} seconds`;
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = Math.floor(sec) % 60;
  const two = n => String(n).padStart(2, '0');
  return h ? `${h} h ${two(m)} m ${two(s)} s` : `${m} m ${two(s)} s`;
}
function shortSpan(sec) {
  if (sec < 1) return `${(sec * 1000).toFixed(0)} thousandths of a second`;
  if (sec < 90) return plural(Math.round(sec), 'second');
  if (sec < 5400) return plural(Math.round(sec / 60), 'minute');
  if (sec < 172800) return plural(Math.round(sec / 3600), 'hour');
  return plural(Math.round(sec / 86400), 'day');
}
function missionAge(launch, now) {
  let y = now.getUTCFullYear() - launch.getUTCFullYear();
  const anniversary = new Date(launch); anniversary.setUTCFullYear(launch.getUTCFullYear() + y);
  if (anniversary > now) { y--; anniversary.setUTCFullYear(launch.getUTCFullYear() + y); }
  const d = Math.floor((now - anniversary) / 864e5);
  return y ? `${plural(y, 'year')}, ${plural(d, 'day')}` : plural(d, 'day');
}

// ---------- The fleet ----------

function buildFleet() {
  $('fleet').innerHTML = SHIPS.map(s => `
    <button type="button" role="tab" class="ship-tab${s.status === 'silent' ? ' silent' : ''}" data-id="${s.id}" style="--c:${s.color}">
      <i aria-hidden="true"></i><span class="t-name">${esc(s.name)}</span><span class="t-sub" data-sub="${s.id}"></span>
    </button>`).join('');
  $('fleet').addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (b) choose(b.dataset.id);
  });
}

function choose(id, fromMap = false) {
  sel = id;
  const ship = byId(id);
  view = ship.near ? 'earth' : 'sun';
  history.replaceState(null, '', '#' + id);
  for (const b of $('fleet').children) b.setAttribute('aria-selected', String(b.dataset.id === id));
  if (!fromMap) $('fleet').querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: still.matches ? 'auto' : 'smooth' });
  fillFile(ship);
  setView(view);
  tick(true);
}

function fillFile(ship) {
  document.body.style.setProperty('--ship', ship.color);
  $('ship-agency').textContent = `${ship.agency} · ${ship.status === 'silent' ? 'Out of contact' : 'On mission'}`;
  $('ship-name').textContent = ship.full || ship.name;
  $('ship-tagline').textContent = ship.tagline;
  $('ship-where').textContent = ship.where;
  $('ship-now').textContent = ship.now;
  $('ship-log').innerHTML = ship.log.map(([d, t]) =>
    `<li><time datetime="${d}">${esc(fmtDate(new Date(d + 'T12:00:00Z'), { timeZone: 'UTC' }))}</time><span>${esc(t)}</span></li>`).join('');
  $('ship-bound').textContent = ship.bound.text;
  const course = $('ship-course');
  course.hidden = !ship.bound.star;
  if (ship.bound.star) {
    course.href = `${BRIDGE}?course=${encodeURIComponent(ship.bound.star)}`;
    course.textContent = `Set course for ${ship.bound.star} →`;
    if (BRIDGE.startsWith('http')) { course.target = '_blank'; course.rel = 'noopener'; }
  }
  $('ship-record').textContent = ship.record || '';
  $('ship-record').hidden = !ship.record;
  $('launched').textContent = `since launch on ${fmtDate(new Date(ship.launched + 'T12:00:00Z'), { timeZone: 'UTC' })}`;
  $('hail').textContent = ship.status === 'silent' ? 'Hail her anyway' : 'Hail her';
  next = milestone(ship);
}

// The next round-number moment for this ship: one light-day from Earth, or the next 10 AU from the Sun.
function milestone(ship) {
  if (ship.near) return null;
  const now = jdOf(Date.now());
  const r = readings(ship.id, now);
  const options = [];
  const lightDay = whenAbove(jd => readings(ship.id, jd).earthAU, LIGHT_DAY_AU, now, 30);
  if (lightDay) options.push({ jd: lightDay, text: 'one light-day from Earth: a hail will take a whole day to reach her' });
  const ten = Math.floor(r.sunAU / 10) * 10 + 10;
  const tenAt = whenAbove(jd => readings(ship.id, jd).sunAU, ten, now, 30);
  if (tenAt) options.push({ jd: tenAt, text: `${ten} AU from the Sun, ${ten} times farther out than Earth` });
  return options.sort((a, b) => a.jd - b.jd)[0] || null;
}

// ---------- Hailing ----------

function hail() {
  const now = Date.now();
  saved.hails[sel] = now;
  save();
  pulses.push({ id: sel, t: performance.now() });
  tick(true);
}

function hailText(ship, r, nowMs) {
  const sent = saved.hails[ship.id];
  const lt = r.lightSeconds * 1000;
  if (!sent || nowMs - sent > 2 * lt + 864e5) {
    if (ship.status === 'silent') return `She can’t answer: her last signal reached Earth on ${fmtDate(new Date(ship.silentSince + 'T12:00:00Z'), { timeZone: 'UTC' })}. A hail sent now would still find her in ${lightTime(r.lightSeconds)}.`;
    return `A hail sent now reaches her ${lt < 6e4 ? `in ${shortSpan(lt / 1000)}` : fmtWhen(new Date(nowMs + lt))}. The soonest her answer could get back is ${lt < 6e4 ? `${shortSpan(2 * lt / 1000)} after you sent it` : fmtWhen(new Date(nowMs + 2 * lt))}.`;
  }
  const arrive = sent + lt, back = sent + 2 * lt;
  const sentText = fmtWhen(new Date(sent));
  if (nowMs < arrive) {
    const pct = (nowMs - sent) / lt * 100;
    return `Your hail, sent ${sentText}, is ${pct < 1 ? pct.toFixed(3) : pct < 10 ? pct.toFixed(1) : Math.floor(pct)}% of the way there. It reaches her ${lt < 6e4 ? `in ${shortSpan((arrive - nowMs) / 1000)}` : fmtWhen(new Date(arrive))}.`;
  }
  if (ship.status === 'silent') return `Your hail, sent ${sentText}, reached her ${lt < 6e4 ? 'already' : fmtWhen(new Date(arrive))}. Nothing came back: she has no power left to answer.`;
  if (nowMs < back) return `Your hail reached her ${lt < 6e4 ? 'already' : fmtWhen(new Date(arrive))}. If she answered at once, the reply lands ${lt < 6e4 ? `in ${shortSpan((back - nowMs) / 1000)}` : fmtWhen(new Date(back))}.`;
  return `Your hail, sent ${sentText}, reached her ${fmtWhen(new Date(arrive))}, and an answer could have been back ${fmtWhen(new Date(back))}. That’s how long every question to her takes.`;
}

// ---------- Numbers on the file ----------

function tick(force = false) {
  const nowMs = Date.now();
  if (!force && nowMs - lastText < 100) return;
  lastText = nowMs;
  const jd = jdOf(nowMs);
  $('clock').textContent = `Stardate ${stardate(new Date(nowMs))}`;
  const ship = byId(sel);
  const r = readings(sel, jd);
  $('sun-km').textContent = `${int(r.sunAU * AU_KM)} km`;
  $('sun-au').textContent = `${r.sunAU.toFixed(r.sunAU < 2 ? 4 : 3)} AU`;
  const earthKm = r.earthAU * AU_KM;
  $('earth-km').textContent = `${int(earthKm)} km`;
  $('earth-au').textContent = ship.near ? `${(earthKm / 384400).toFixed(2)} times as far as the Moon` : `${r.earthAU.toFixed(3)} AU`;
  if (ship.near) {
    const e0 = jwstFromEarth(jd), e1 = jwstFromEarth(jd + 1 / 24);
    const around = Math.hypot(...e1.map((v, k) => v - e0[k])) / 3600;
    $('speed').textContent = `${r.speedKmS.toFixed(1)} km/s`;
    $('speed-h').textContent = `round the Sun with Earth, and ${around.toFixed(2)} km/s round L2`;
  } else {
    $('speed').textContent = `${r.speedKmS.toFixed(2)} km/s`;
    $('speed-h').textContent = `${int(Math.round(r.speedKmS * 36) * 100)} km/h, relative to the Sun`;
  }
  $('signal').textContent = lightTime(r.lightSeconds);
  $('signal-note').textContent = 'one way, at the speed of light';
  $('age').textContent = missionAge(new Date(ship.launched + 'T12:00:00Z'), new Date(nowMs));
  $('hail-note').textContent = hailText(ship, r, nowMs);

  const n = $('next');
  n.hidden = !next;
  if (next) {
    const days = next.jd - jd;
    const when = fmtDate(dateOf(next.jd));
    n.innerHTML = `<b>Next milestone</b> ${esc(when)}${days < 400 ? ` (${days < 1 ? 'today' : `in ${plural(Math.ceil(days), 'day')}`})` : ''}: ${esc(next.text)}.`;
  }

  const warp = $('ship-warp');
  const w9 = r.lightSeconds / warpSpeed(9);
  warp.textContent = ship.near
    ? `At full impulse, a quarter of light speed, you’d reach her from Earth in ${shortSpan(r.lightSeconds * 4)}.`
    : `At warp 9 you’d catch her in ${shortSpan(w9)}. She has been flying for ${missionAge(new Date(ship.launched + 'T12:00:00Z'), new Date(nowMs)).split(',')[0]}.`;

  for (const s of SHIPS) {
    const el = $('fleet').querySelector(`[data-sub="${s.id}"]`);
    if (!el) continue;
    const rs = s.id === sel ? r : readings(s.id, jd);
    el.textContent = s.near ? `${(rs.earthAU * AU_KM / 1e6).toFixed(2)} million km` : `${rs.sunAU.toFixed(1)} AU`;
  }
}

// ---------- The map ----------

const canvas = $('map');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
const R_MIN = 0.6, R_MAX = 230; // AU at the centre and at the edge of the Solar System view
const NEAR_SPAN = 2.1e6; // km from Earth to the edge of the near-Earth view
const pulses = [];
let shipsOnMap = []; // where each ship was drawn, for tapping
let placed = []; // ship labels already on the map this frame, so the next one can step around them

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
}

// Solar System view: distance from the Sun on a log scale, direction as seen from above the planets' plane.
function sunXY(p) {
  const d = Math.hypot(p[0], p[1], p[2]);
  const ang = Math.atan2(p[1], p[0]);
  const rr = radius(d);
  return [W / 2 + rr * Math.cos(ang), CY() - rr * Math.sin(ang)];
}
// The view buttons sit over the top of the map, so the Sun sits a little below the middle.
const TOP = 46;
const CY = () => (H + TOP) / 2;
const RMAP = () => Math.min(W, H - TOP) / 2 - 14;
function radius(d) {
  const R = RMAP();
  return R * Math.max(0, Math.log(Math.max(d, R_MIN) / R_MIN) / Math.log(R_MAX / R_MIN));
}

// Near-Earth view: km from Earth, turning with Earth so the Sun is always off to the left.
function nearFrame(jd) {
  const e = earthAt(jd);
  const a = Math.atan2(e[1], e[0]);
  return [Math.cos(a), Math.sin(a)];
}
function nearXY(p, frame) {
  const [c, s] = frame;
  const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c;
  const k = RMAP() / NEAR_SPAN;
  return [W / 2 - W * 0.12 + u * k, CY() - v * k];
}

function draw(now) {
  const nowMs = Date.now();
  const jd = jdOf(nowMs);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  shipsOnMap = [];
  placed = [];
  if (view === 'sun') drawSun(jd, now, nowMs); else drawNear(jd, now, nowMs);
}

function ring(r, style, dash = []) {
  ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = style; ctx.lineWidth = 1;
  ctx.arc(W / 2, CY(), r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}
function label(text, x, y, color, align = 'left', size = 11) {
  ctx.font = `600 ${size}px 'Chakra Petch', 'Arial Narrow', sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(4, 6, 11, 0.85)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function ringLabel(text, r, color, a) {
  label(text, W / 2 + r * Math.cos(a), CY() + r * Math.sin(a), color, 'center', 10);
}

function drawSun(jd, now, nowMs) {
  // The Kuiper Belt and the rings.
  ctx.beginPath();
  ctx.arc(W / 2, CY(), radius(50), 0, Math.PI * 2); ctx.arc(W / 2, CY(), radius(30), 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(160, 190, 255, 0.05)'; ctx.fill();
  ringLabel('Kuiper Belt', radius(40), 'rgba(160, 180, 220, 0.5)', -Math.PI * 0.75);
  for (const p of ['earth', 'jupiter', 'saturn', 'uranus', 'neptune']) ring(radius(semiMajor(p)), 'rgba(140, 180, 255, 0.14)');
  ring(radius(121), 'rgba(255, 181, 74, 0.4)', [5, 5]);
  label('Edge of the Sun’s bubble', W / 2 - radius(121) + 4, CY() - 9, 'rgba(255, 181, 74, 0.75)', 'left', 10);
  ring(radius(LIGHT_DAY_AU), 'rgba(134, 216, 255, 0.35)', [1.5, 4]);
  ringLabel('One light-day', radius(LIGHT_DAY_AU), 'rgba(134, 216, 255, 0.75)', -Math.PI * 0.27);

  // The Sun.
  const g = ctx.createRadialGradient(W / 2, CY(), 0, W / 2, CY(), 16);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.3, '#ffd27a'); g.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, CY(), 16, 0, Math.PI * 2); ctx.fill();

  // The planets, where they are now.
  const names = { earth: 'Earth', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto' };
  for (const p of Object.keys(names)) {
    const [x, y] = sunXY(planetAt(p, jd));
    ctx.fillStyle = p === 'earth' ? '#7fb8ff' : '#c9d3e6';
    ctx.beginPath(); ctx.arc(x, y, p === 'earth' ? 3.2 : 2.6, 0, Math.PI * 2); ctx.fill();
    label(names[p], x + 6, y - 7, p === 'earth' ? '#9cc8ff' : 'rgba(201, 211, 230, 0.7)', 'left', 10);
  }

  // Where each ship has been, then where it is.
  const order = SHIPS.filter(s => !s.near).sort((a, b) => (a.id === sel) - (b.id === sel));
  for (const s of order) {
    const on = s.id === sel;
    const pts = trackUntil(s.id, jd);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i - 1] || pts[0], b = pts[i];
      for (let k = i ? 1 : 0; k <= 6; k++) {
        const t = k / 6, [x, y] = sunXY(a.map((v, j) => v + (b[j] - v) * t));
        if (i === 0 && k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = on ? s.color : withAlpha(s.color, s.status === 'silent' ? 0.22 : 0.35);
    ctx.lineWidth = on ? 1.8 : 1.2;
    if (s.status === 'silent') ctx.setLineDash([3, 3]);
    ctx.stroke(); ctx.setLineDash([]);
    const here = readings(s.id, jd).pos;
    const ahead = readings(s.id, jd + 3650).pos;
    const [x, y] = sunXY(here), [x2, y2] = sunXY(ahead);
    marker(s, x, y, Math.atan2(y2 - y, x2 - x), on, now);
    shipsOnMap.push({ id: s.id, x, y });
    shipLabel(s, x, y, on);
  }
  // Webb rides along with Earth at this scale.
  const webb = byId('jwst');
  const [ex, ey] = sunXY(readings('jwst', jd).pos);
  shipsOnMap.push({ id: 'jwst', x: ex, y: ey });
  ctx.fillStyle = webb.color; ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, Math.PI * 2); ctx.fill();

  drawHail(jd, now, nowMs, p => sunXY(p), earthAt(jd));
  $('scale').textContent = 'Seen from above the planets. Distance from the Sun is stretched so everything fits; dashed paths are ships that have gone silent.';
}

function drawNear(jd, now, nowMs) {
  const frame = nearFrame(jd);
  const [cx, cy] = nearXY([0, 0, 0], frame);
  const k = RMAP() / NEAR_SPAN;
  // Toward the Sun.
  ctx.strokeStyle = 'rgba(255, 210, 122, 0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(14, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20, cy - 5); ctx.lineTo(13, cy); ctx.lineTo(20, cy + 5); ctx.stroke();
  label('To the Sun', 14, cy + 14, 'rgba(255, 210, 122, 0.85)', 'left', 10);
  // The Moon's orbit and the Moon.
  ctx.beginPath(); ctx.arc(cx, cy, 384400 * k, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(140, 180, 255, 0.18)'; ctx.stroke();
  const [mx, my] = nearXY(moonAt(jd), frame);
  ctx.fillStyle = '#c9d3e6'; ctx.beginPath(); ctx.arc(mx, my, 2.6, 0, Math.PI * 2); ctx.fill();
  label('Moon', mx + 6, my - 8, 'rgba(201, 211, 230, 0.75)', 'left', 10);
  // Earth.
  ctx.fillStyle = '#7fb8ff'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  label('Earth', cx, cy + 16, '#9cc8ff', 'center', 11);
  // L2.
  const lx = cx + 1.5e6 * k;
  ctx.strokeStyle = 'rgba(255, 181, 74, 0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx - 5, cy - 5); ctx.lineTo(lx + 5, cy + 5); ctx.moveTo(lx + 5, cy - 5); ctx.lineTo(lx - 5, cy + 5); ctx.stroke();
  label('L2', lx, cy + 15, 'rgba(255, 181, 74, 0.85)', 'center', 10);

  // Webb's loop around L2: the next three months solid, the past three faint, each point turned to Earth's frame then.
  const webb = byId('jwst');
  const [t0, t1] = jwstSpan();
  for (const [from, to, alpha] of [[t0, t1, 0.25], [jd, jd + 90, 0.8]]) {
    ctx.beginPath();
    let first = true;
    for (let t = Math.max(from, t0); t <= Math.min(to, t1); t += 1) {
      const [x, y] = nearXY(jwstFromEarth(t), nearFrame(t));
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = withAlpha(webb.color, alpha); ctx.lineWidth = 1.4;
    if (alpha < 0.5) ctx.setLineDash([3, 3]);
    ctx.stroke(); ctx.setLineDash([]);
  }
  const [wx, wy] = nearXY(jwstFromEarth(jd), frame);
  const [ax, ay] = nearXY(jwstFromEarth(jd + 3), nearFrame(jd + 3));
  marker(webb, wx, wy, Math.atan2(ay - wy, ax - wx), sel === 'jwst', now);
  shipsOnMap.push({ id: 'jwst', x: wx, y: wy });
  label('James Webb', wx + 10, wy - 12, webb.color, 'left', 12);

  drawHail(jd, now, nowMs, p => nearXY(p, frame), [0, 0, 0], true);
  $('scale').textContent = 'Seen from above, turning with Earth so the Sun stays to the left. The bright line is where Webb goes in the next three months. The other ships are billions of km off the map.';
}

// A ship's name beside it, nudged up or down until it clears the names already drawn.
function shipLabel(s, x, y, on) {
  const size = on ? 12 : 11;
  ctx.font = `600 ${size}px 'Chakra Petch', 'Arial Narrow', sans-serif`;
  const w = ctx.measureText(s.name).width + 4, left = x < W / 2;
  const lx = left ? x - 10 : x + 10, x0 = left ? lx - w : lx;
  let ly = y + (y < CY() ? -11 : 12);
  const step = y < CY() ? -14 : 14;
  for (let k = 0; k < 6 && placed.some(r => x0 < r.x1 && x0 + w > r.x0 && Math.abs(ly - r.y) < 13); k++) ly += step;
  placed.push({ x0, x1: x0 + w, y: ly });
  label(s.name, lx, ly, on ? s.color : withAlpha(s.color, 0.75), left ? 'right' : 'left', size);
}

// A ship: a little arrowhead pointing the way it's going, ringed when it's the one on file.
function marker(s, x, y, dir, on, now) {
  const silent = s.status === 'silent';
  if (on && !silent && !still.matches) {
    const t = (now / 2400) % 1;
    ctx.beginPath(); ctx.arc(x, y, 6 + t * 16, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(s.color, 0.5 * (1 - t)); ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, -4.5); ctx.closePath();
  ctx.fillStyle = silent ? withAlpha(s.color, on ? 0.9 : 0.6) : s.color;
  ctx.shadowColor = s.color; ctx.shadowBlur = silent ? 0 : on ? 10 : 5;
  ctx.fill();
  ctx.restore();
  if (on) { ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.strokeStyle = withAlpha(s.color, 0.7); ctx.lineWidth = 1; ctx.stroke(); }
}

// A hail on its way: a bright dot crawling from Earth to the ship, and back again for the answer. The real trip takes
// hours, so a fresh hail also gets a quick sweep along the same line to show which way it went.
function drawHail(jd, now, nowMs, toXY, earthPos, near = false) {
  const ship = byId(sel);
  const sent = saved.hails[sel];
  const shipPos = near ? jwstFromEarth(jd) : readings(sel, jd).pos;
  const [ex, ey] = toXY(earthPos), [sx, sy] = toXY(shipPos);
  const along = (f, color, size) => {
    const x = ex + (sx - ex) * f, y = ey + (sy - ey) * f;
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  };
  if (sent) {
    const lt = readings(sel, jd).lightSeconds * 1000;
    const f = (nowMs - sent) / lt;
    if (f > 0 && f < 2 && ship.status !== 'silent' || f > 0 && f < 1) {
      ctx.strokeStyle = 'rgba(134, 216, 255, 0.25)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
      along(f < 1 ? f : 2 - f, f < 1 ? '#86d8ff' : '#6fe3a4', 3);
    }
  }
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    const t = (now - p.t) / 1600;
    if (t > 1 || p.id !== sel) { pulses.splice(i, 1); continue; }
    if (still.matches) continue;
    along(t, `rgba(134, 216, 255, ${1 - t * 0.6})`, 2.2);
    ctx.beginPath(); ctx.arc(ex, ey, 4 + t * 26, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(134, 216, 255, ${0.6 * (1 - t)})`; ctx.lineWidth = 1.2; ctx.stroke();
  }
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function setView(v) {
  view = v;
  $('view-sun').setAttribute('aria-pressed', String(v === 'sun'));
  $('view-earth').setAttribute('aria-pressed', String(v === 'earth'));
}

// ---------- Running ----------

function frame(now) {
  draw(now);
  tick();
  requestAnimationFrame(frame);
}

function bind() {
  $('hail').addEventListener('click', hail);
  $('view-sun').addEventListener('click', () => { setView('sun'); if (byId(sel).near) choose('v1'); });
  $('view-earth').addEventListener('click', () => { setView('earth'); if (!byId(sel).near) choose('jwst'); });
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bestD = 28;
    for (const s of shipsOnMap) { const d = Math.hypot(s.x - x, s.y - y); if (d < bestD) { best = s; bestD = d; } }
    if (best && best.id !== sel) choose(best.id, true);
  });
  addEventListener('resize', resize);
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (byId(id) && id !== sel) choose(id); });
}

buildFleet();
resize();
bind();
choose(sel);
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.missions = { get sel() { return sel; }, get view() { return view; }, readings, choose };
