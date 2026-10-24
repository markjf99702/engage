// The warp scale explorer: pick a place, and five ships race there from Earth at warp 9.975, your own warp, warp 5,
// light speed and Voyager 1's real speed, on a clock that speeds up as they go.
import { warpSpeed } from './physics.js';
import {
  LANES, GROUPS, PLACES, byId, distanceLy, laneSpeed, tripYears, raceClock,
  formatSpan, formatShort, formatLight, arrivalYear, lightLeft, LADDER, ladderAt,
} from './warp-scale.js';

const KEY = 'engage.warp.v1';
// Where Engage itself is. The single-file copy points this at the live site.
const BRIDGE = './';
const AWAY = BRIDGE.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const still = matchMedia('(prefers-reduced-motion: reduce)');
const UNIVERSE = 13.8e9;
const LIGHT_KINDS = new Set(['star', 'cluster', 'nebula', 'core', 'galaxy']);

const saved = load();
let place = byId.get(saved.place) || byId.get('core');
let custom = saved.warp;
let trip = null; // the lanes' speeds and times for the place
let race = null; // { start, clock } while the race runs; { done: true } once everyone is there
let lastNote = '';
const cv = $('race');
const g = cv.getContext('2d');
const field = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* start again */ }
  const warp = Number(s.warp);
  return { place: typeof s.place === 'string' ? s.place : null, warp: warp >= 1 && warp <= 9.99 ? warp : 9 };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ place: place.id, warp: custom })); } catch { /* fine */ } }

const warpName = w => `Warp ${w.toFixed(2).replace(/\.?0+$/, '')}`;
const times = n => `${n < 10 ? n.toFixed(n < 1 ? 5 : 1).replace(/\.?0+$/, '') : Math.round(n).toLocaleString('en-US')} × light`;
const laneLabel = l => (l.id === 'custom' ? warpName(custom) : l.label);

// ---------- Working out the trip ----------

function plan() {
  const now = new Date();
  const ly = distanceLy(place, now);
  const lanes = LANES.map(l => {
    const c = laneSpeed(l, custom, now);
    return { ...l, label: laneLabel(l), c, years: tripYears(ly, c) };
  });
  trip = { ly, lanes, clock: raceClock(lanes.map(l => l.years)), now };
}

function select(id, { scroll = false } = {}) {
  const p = byId.get(id);
  if (!p) return;
  place = p;
  race = null;
  plan();
  save();
  try { history.replaceState(null, '', `${location.search}#${id}`); } catch { /* fine */ }
  renderPlace();
  renderLadder();
  setButton();
  note(startNote());
  draw(0);
  if (scroll) document.querySelector('.race').scrollIntoView({ block: 'start', behavior: still.matches ? 'auto' : 'smooth' });
}

function setCustom(w) {
  custom = Math.min(Math.max(Math.round(w * 100) / 100, 1), 9.99);
  $('custom-warp').value = custom;
  $('custom-out').textContent = custom.toFixed(2).replace(/\.?0+$/, '');
  $('custom-speed').textContent = times(warpSpeed(custom));
  $('custom-warp').style.setProperty('--fill', `${(custom - 1) / 8.99 * 100}%`);
  race = null;
  plan();
  save();
  renderPlace();
  setButton();
  note(startNote());
  draw(0);
}

// ---------- The race ----------

function engage() {
  if (race && !race.done) return skip();
  if (!trip) plan();
  if (still.matches) return finish();
  race = { start: performance.now() };
  lastNote = '';
  setButton();
  note('Engaging…');
  requestAnimationFrame(tick);
}

function skip() { finish(); }

function finish() {
  race = { done: true };
  setButton();
  note(endNote());
  draw(trip.clock.seconds);
  markArrived(Infinity);
}

function tick(now) {
  if (!race || race.done) return;
  const s = race.frozen ?? (now - race.start) / 1000;
  if (s >= trip.clock.seconds) return finish();
  draw(s);
  const t = trip.clock.at(s);
  const there = trip.lanes.filter(l => l.years <= t);
  markArrived(t);
  if (there.length) {
    const l = there[there.length - 1];
    note(`${l.label} is there, after ${formatSpan(l.years)}.`);
  }
  if (!race.frozen) requestAnimationFrame(tick);
}

// Holds the race at a moment, for the screenshots.
function freeze(s) {
  race = { frozen: s };
  setButton();
  tick(0);
}

function setButton() {
  const b = $('go');
  b.textContent = race && !race.done ? 'Skip ahead' : race?.done ? 'Race again' : 'Engage';
}

function note(text) {
  if (text === lastNote) return;
  lastNote = text;
  $('race-note').textContent = text;
}

function startNote() {
  const where = place.name.replace(/^The /, 'the ');
  return `Five ships leave Earth together for ${where}. The clock speeds up as they go, so even the slowest gets there.`;
}

function endNote() {
  const [fast] = trip.lanes, light = trip.lanes.find(l => l.id === 'w1'), slow = trip.lanes[trip.lanes.length - 1];
  let s = `At warp 9.975 it’s ${formatSpan(fast.years)}, where light takes ${formatSpan(light.years)}.`;
  if (slow.years > UNIVERSE) s += ` Voyager 1 would need ${Math.round(slow.years / UNIVERSE)} times the age of the universe.`;
  else s += ` Voyager 1 would take ${formatSpan(slow.years)}.`;
  return s;
}

function markArrived(t) {
  document.querySelectorAll('#times tr[data-lane]').forEach(tr => {
    const l = trip.lanes.find(x => x.id === tr.dataset.lane);
    tr.classList.toggle('there', !!race && l.years <= t);
  });
}

// ---------- Drawing ----------

function size() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w: r.width, h: r.height, dpr };
}

function draw(s) {
  if (!trip) return;
  const { w, h, dpr } = size();
  if (!w) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const running = race && !race.done;
  const t = race?.done ? Infinity : race ? trip.clock.at(s) : 0;

  g.fillStyle = '#02040a';
  g.fillRect(0, 0, w, h);
  // Stars drifting past, faster as the race goes on.
  const drift = running ? s * (40 + s * 30) : 0;
  for (const [x, y, b] of field) {
    const px = ((x * w - drift * (0.3 + b)) % w + w) % w, py = y * h;
    const streak = running ? Math.min(40, 2 + s * s * b * 1.4) : 0;
    g.strokeStyle = `rgba(200, 220, 255, ${(running ? 0.06 : 0.15) + b * (running ? 0.22 : 0.45)})`;
    g.lineWidth = b > 0.8 ? 1.4 : 0.8;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + streak + 0.6, py); g.stroke();
  }

  // The clock and where we're going.
  const pad = 16;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#93a0b8';
  g.font = '600 10px "Chakra Petch", sans-serif';
  letter(g, 'ELAPSED', pad, 22, 1.6);
  g.textAlign = 'right';
  letter(g, 'DESTINATION', w - pad, 22, 1.6, 'right');
  g.textAlign = 'left';
  g.fillStyle = '#ffb54a';
  g.font = '600 22px "Chakra Petch", sans-serif';
  const shown = race?.done ? trip.lanes[trip.lanes.length - 1].years : t;
  g.fillText(race ? formatSpan(shown) : '—', pad, 48);
  g.textAlign = 'right';
  g.fillStyle = '#e8edf6';
  g.font = '600 15px "Chakra Petch", sans-serif';
  g.fillText(fit(g, place.name, w / 2 - pad), w - pad, 40);
  g.fillStyle = '#86d8ff';
  g.font = '500 12px "IBM Plex Sans", sans-serif';
  g.fillText(formatLight(trip.ly), w - pad, 56);
  g.textAlign = 'left';

  const top = 72, rowH = (h - top - 8) / trip.lanes.length;
  const x0 = pad + 6, x1 = w - pad - 6;
  trip.lanes.forEach((l, k) => {
    const y = top + k * rowH;
    const p = race ? Math.min(1, t / l.years) : 0;
    const there = race && p >= 1;
    // Label and status.
    g.font = '600 12px "Chakra Petch", sans-serif';
    g.fillStyle = l.color;
    letter(g, l.label.toUpperCase(), pad, y + 14, 1.2);
    g.textAlign = 'right';
    g.font = '500 12px "Chakra Petch", sans-serif';
    g.fillStyle = there ? l.color : '#93a0b8';
    const status = !race ? formatSpan(l.years) : there ? `✓ ${formatSpan(l.years)}` : `${pct(p)} of the way`;
    g.fillText(status, w - pad, y + 14);
    g.textAlign = 'left';
    // The track.
    const ty = y + rowH * 0.48;
    g.strokeStyle = 'rgba(140, 180, 255, 0.18)';
    g.lineWidth = 1;
    g.setLineDash([2, 4]);
    g.beginPath(); g.moveTo(x0, ty); g.lineTo(x1, ty); g.stroke();
    g.setLineDash([]);
    dot(g, x0, ty, 3.5, '#5aa0ff');
    dot(g, x1, ty, there ? 5 : 3.5, place.color, there ? 14 : 0);
    // The ship and its wake.
    const sx = x0 + (x1 - x0) * p;
    const wake = running && !there && p > 0 ? Math.min(sx - x0, 10 + 70 * Math.min(1, Math.log10(1 + l.c * 1e4) / 8)) : 0;
    if (wake > 1) {
      const grad = g.createLinearGradient(sx - wake, 0, sx, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, l.color);
      g.strokeStyle = grad;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx - wake, ty); g.lineTo(sx, ty); g.stroke();
    }
    ship(g, Math.min(sx, x1 - 6), ty, l.color);
    // Speed underneath.
    g.font = '400 11px "IBM Plex Sans", sans-serif';
    g.fillStyle = '#727f97';
    g.fillText(fit(g, `${times(l.c)} · ${l.id === 'custom' ? 'set it below' : l.note}`, w - pad * 2), pad, ty + 19);
  });
}

function letter(ctx, text, x, y, spacing, align = 'left') {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, align === 'right' ? x + spacing : x, y);
    ctx.letterSpacing = '0px';
  } else ctx.fillText(text, x, y);
}

function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 4 && ctx.measureText(t + '…').width > width) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

function dot(ctx, x, y, r, color, glow = 0) {
  ctx.save();
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function ship(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x + 7, y);
  ctx.lineTo(x - 5, y - 5);
  ctx.lineTo(x - 2, y);
  ctx.lineTo(x - 5, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function pct(p) {
  const v = p * 100;
  if (v === 0) return '0%';
  if (v < 0.001) return 'under 0.001%';
  if (v < 1) return `${Number(v.toPrecision(1))}%`;
  return `${Math.floor(v)}%`;
}

// ---------- The place card ----------

function renderPlace() {
  const p = place, ly = trip.ly;
  const group = GROUPS.find(([id]) => id === p.group)[1];
  const left = LIGHT_KINDS.has(p.kind) ? lightLeft(ly, trip.now) : null;
  const rows = trip.lanes.map(l => {
    const year = arrivalYear(l.years, trip.now);
    return `<tr data-lane="${l.id}"><th scope="row"><i style="background:${l.color}"></i>${esc(l.label)}</th>
      <td>${esc(formatSpan(l.years))}${l.years > UNIVERSE ? '<span class="arrive">longer than the universe has existed</span>' : year ? `<span class="arrive">arrives ${year}</span>` : ''}</td></tr>`;
  }).join('');
  const ticks = LADDER.map(([v, name]) => `<span class="tick" style="left:${(ladderAt(v) * 100).toFixed(2)}%" title="${esc(name)}"><span>${esc(shortTick(name))}</span></span>`).join('');
  $('place').innerHTML = `
    <p class="eyebrow">${esc(group)}</p>
    <h2>${esc(p.name)}</h2>
    <p class="dist">${esc(formatLight(ly))} from Earth${p.live ? ' today' : ''}${left ? ` · the light you see left ${esc(left)}` : ''}</p>
    <div class="scale-bar" aria-hidden="true">${ticks}<span class="mark" style="left:${(Math.min(Math.max(ladderAt(ly), 0), 1) * 100).toFixed(2)}%;--c:${p.color}"></span></div>
    <p class="about">${esc(p.about)}</p>
    ${p.trek ? `<p class="trek"><b>Star Trek</b> ${esc(p.trek)}</p>` : ''}
    <table class="times" id="times"><caption>Leaving Earth now</caption><tbody>${rows}</tbody></table>
    ${p.course ? `<a class="to-file" href="${BRIDGE}?course=${encodeURIComponent(p.course)}"${AWAY}>Set course on the bridge <span aria-hidden="true">→</span></a>` : ''}
  `;
  markArrived(race?.done ? Infinity : 0);
}

const shortTick = name => ({ 'light-second': '1 sec', 'light-minute': '1 min', 'light-hour': '1 hr', 'light-day': '1 day', 'light year': '1 yr', '1,000 ly': '1,000 yr', 'million ly': '1M yr' })[name];

// ---------- The ladder ----------

function renderLadder() {
  const now = trip.now;
  const html = GROUPS.map(([gid, gname]) => {
    // The planets move about, so the Solar System's order changes: Mars is sometimes nearer than the Sun.
    const here = PLACES.filter(p => p.group === gid).map(p => [p, distanceLy(p, now)]).sort((a, b) => a[1] - b[1]);
    const rungs = here.map(([p, ly]) => {
      const at = id => formatShort(tripYears(ly, laneSpeed(LANES.find(l => l.id === id), custom, now)));
      return `<button class="rung${p.headline ? ' headline' : ''}" type="button" data-id="${p.id}" aria-current="${p === place}">
        <span class="rung-name"><b>${esc(p.name)}</b><span>${esc(formatLight(ly))}</span></span>
        <span class="t w9975">${at('w9975')}</span><span class="t w5">${at('w5')}</span><span class="t w1">${at('w1')}</span></button>`;
    }).join('');
    return `<h3 class="rung-group">${esc(gname)}</h3>${rungs}`;
  }).join('');
  $('ladder').innerHTML = html;
}

// ---------- Start ----------

const fromLink = () => {
  const warp = Number(new URLSearchParams(location.search).get('warp'));
  return { id: decodeURIComponent(location.hash.slice(1)), warp: warp >= 1 && warp <= 9.99 ? warp : null };
};

$('go').addEventListener('click', engage);
$('custom-warp').addEventListener('input', e => setCustom(Number(e.target.value)));
$('ladder').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) select(b.dataset.id, { scroll: true });
});
addEventListener('hashchange', () => { const { id } = fromLink(); if (byId.has(id) && id !== place.id) select(id); });
addEventListener('resize', () => { if (!race || race.done) draw(race ? trip.clock.seconds : 0); });
document.fonts?.ready.then(() => { if (!race || race.done) draw(race ? trip.clock.seconds : 0); });

window.warpScale = {
  select, engage, skip, setCustom, freeze,
  get place() { return place.id; },
  get trip() { return trip; },
  get running() { return !!race && !race.done; },
  get done() { return !!race?.done; },
};

{
  const link = fromLink();
  if (link.warp) custom = link.warp;
  if (byId.has(link.id)) place = byId.get(link.id);
  $('custom-warp').value = custom;
  setCustom(custom);
  select(place.id);
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
