// The bridge: the helm console, the flight between stars, the log, and the controls for looking around.
import { loadCatalog } from './catalog.js';
import { Sky } from './sky.js';
import { sound } from './audio.js';
import { DESTINATIONS, GROUPS } from './destinations.js';
import { composeEntry, describeKind, notesFor, titleFor } from './log.js';
import { filesForStar, label as classLabel } from './classes.js';
import {
  AU_PER_PC, LY_PER_PC, apparentMag, formatDuration, formatLy, holdDistanceAU, stardate, tripYears, warpSpeed,
} from './physics.js';

const KEY = 'engage.v1';
// The planetary survey page. The single-file copy points this at the live site.
const SURVEY = 'survey.html';
const AWAY = SURVEY.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
const $ = id => document.getElementById(id);
const DEG = Math.PI / 180;
const START_YAW = 83 * DEG, START_PITCH = 3 * DEG; // facing Orion, with the Sun behind
const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega' };

let cat, sky;
let trip = null, turn = null, dirty = true, last = performance.now();
let speedUp = 1; // tests and screenshots fly faster

const state = defaults();

function defaults() {
  return {
    at: 0, offset: homeOffset(), yaw: START_YAW, pitch: START_PITCH, fov: 60 * DEG,
    target: null, warp: 9, log: [], ly: 0, opts: { lines: true, labels: true, sound: true }, seenIntro: false,
  };
}

function homeOffset() {
  const { f } = Sky.basis(START_YAW, START_PITCH);
  return f.map(v => v / AU_PER_PC); // one AU out from the Sun, on the night side
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') Object.assign(state, saved, { opts: { ...state.opts, ...saved.opts } });
  } catch { /* no storage: start fresh */ }
  if (!(state.at >= 0 && state.at < cat.count)) Object.assign(state, defaults());
}

function save() {
  const { at, offset, yaw, pitch, fov, target, warp, log, ly, opts, seenIntro } = state;
  try { localStorage.setItem(KEY, JSON.stringify({ at, offset, yaw, pitch, fov, target, warp, log, ly, opts, seenIntro })); } catch { /* fine */ }
}

const starPos = i => [cat.pos[i * 3], cat.pos[i * 3 + 1], cat.pos[i * 3 + 2]];
const camAbs = () => (trip ? trip.cam : starPos(state.at).map((v, k) => v + state.offset[k]));
const holdAU = i => notesFor(cat, i)?.hold?.au ?? holdDistanceAU(cat.radius[i]);
const lyFromShip = i => cat.distanceFrom(i, camAbs()) * LY_PER_PC;

// ---------- Startup ----------

async function start() {
  const img = new Image();
  img.src = 'img/milkyway.png';
  [cat] = await Promise.all([loadCatalog(), img.decode()]);
  load();
  sound.on = state.opts.sound;
  try {
    sky = new Sky($('sky'), cat, img);
  } catch (e) {
    $('loading').textContent = 'This browser can’t draw the viewscreen (it needs WebGL).';
    throw e;
  }
  sky.setOrigin(starPos(state.at));
  watchGraphics();
  $('loading').remove();
  $('opt-lines').checked = state.opts.lines;
  $('opt-labels').checked = state.opts.labels;
  $('opt-sound').checked = state.opts.sound;
  $('warp').value = state.warp;
  updateWarp();
  setTarget(state.target, false);
  courseFromLink();
  updateHud();
  if (!state.seenIntro) $('intro').hidden = false;
  bind();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.engage = hooks();
}

// A link like ?course=Proxima%20Centauri, from the planetary survey, sets course for that star.
function courseFromLink() {
  const name = new URLSearchParams(location.search).get('course');
  if (name == null) return;
  const i = cat.byName.get(name);
  if (i !== undefined) setTarget(i);
  history.replaceState(null, '', location.pathname + location.hash);
}

// ---------- Drawing ----------

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (trip) fly(now, dt);
  if (turn) steer(now);
  const pulsing = state.sunPulse && now - state.sunPulse < 2400;
  if (dirty || trip || turn || pulsing) {
    sky.render(viewNow(dt));
    drawLabels(now);
    dirty = false;
  }
  requestAnimationFrame(frame);
}

const viewNow = dt => ({
  cam: camAbs(), yaw: state.yaw, pitch: state.pitch, fov: state.fov, lines: state.opts.lines,
  warp: trip?.warp || 0, warpSpeed: trip?.streak || 0, dt,
});

// The graphics driver can reset under the page (a long freeze, waking a laptop). The browser usually hands the
// viewscreen back on its own within a moment; if it doesn't, offer a reload instead of leaving a blank screen.
let lostTimer = 0;
function watchGraphics() {
  const canvas = $('sky');
  sky.onlost = () => {
    canvas.style.visibility = 'hidden';
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => { $('lost').hidden = false; }, 2500);
  };
  sky.onrestored = () => {
    clearTimeout(lostTimer);
    canvas.style.visibility = '';
    $('lost').hidden = true;
    dirty = true;
  };
  $('lost-reload').addEventListener('click', () => location.reload());
}

let labelCandidates = null;
function candidates() {
  if (labelCandidates) return labelCandidates;
  const set = new Set(DESTINATIONS.map(d => cat.byName.get(d.star)));
  cat.names.forEach((n, i) => {
    if (i > 0 && !/^(HIP|HD|HYG|Gliese) |^\d|^[α-ω]/.test(n) && apparentMag(cat.absmag[i], Math.hypot(...starPos(i))) < 2.6) set.add(i);
  });
  return (labelCandidates = [...set].filter(i => i !== undefined));
}

function drawLabels(now) {
  const c = $('labels');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const cam = camAbs();
  const taken = [];
  const free = (x, y, tw) => {
    const r = [x - 2, y - 12, x + tw + 2, y + 4];
    if (taken.some(t => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1])) return false;
    taken.push(r);
    return true;
  };
  const onScreen = p => p && !p.behind && p.x > -20 && p.y > -20 && p.x < w + 20 && p.y < h + 20;

  // The target: brackets and its name.
  const target = trip ? trip.i : state.target;
  if (target != null) {
    const p = sky.project(target);
    if (onScreen(p)) {
      const r = 15;
      g.strokeStyle = '#86d8ff';
      g.lineWidth = 1.5;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.moveTo(p.x + sx * r, p.y + sy * (r - 6));
        g.lineTo(p.x + sx * r, p.y + sy * r);
        g.lineTo(p.x + sx * (r - 6), p.y + sy * r);
      }
      g.stroke();
      label(g, titleFor(cat, target), formatLy(cat.distanceFrom(target, cam) * LY_PER_PC), p.x + r + 6, p.y + 4, '#86d8ff');
      free(p.x + r + 6, p.y + 4, 140);
    }
  }

  // The Sun, wherever we are: a dashed ring, even when it is too faint to see.
  if (Math.hypot(...cam) > 0.002) {
    const p = sky.project(0);
    if (onScreen(p)) {
      const pulse = state.sunPulse && now > state.sunPulse && now - state.sunPulse < 2400 ? 1 + 0.6 * Math.sin((now - state.sunPulse) / 120) * (1 - (now - state.sunPulse) / 2400) : 1;
      g.strokeStyle = '#ffd27a';
      g.lineWidth = 1.3;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.arc(p.x, p.y, 11 * pulse, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      const m = apparentMag(4.83, Math.hypot(...cam));
      label(g, 'Sol', `mag ${m.toFixed(1)}`, p.x + 16, p.y + 4, '#ffd27a');
      free(p.x + 16, p.y + 4, 90);
    }
  }

  if (!state.opts.labels || trip) return;
  const shown = [];
  for (const i of candidates()) {
    if (i === target || i === state.at || i === 0) continue;
    const d = cat.distanceFrom(i, cam);
    const m = apparentMag(cat.absmag[i], d);
    const curated = !!notesFor(cat, i);
    if (m > (curated ? 5.5 : 2.2)) continue;
    const p = sky.project(i);
    if (!onScreen(p)) continue;
    shown.push([m, i, p]);
  }
  shown.sort((a, b) => a[0] - b[0]);
  g.font = '500 12px "IBM Plex Sans", system-ui, sans-serif';
  for (const [, i, p] of shown.slice(0, 24)) {
    const text = titleFor(cat, i);
    const tw = g.measureText(text).width;
    if (!free(p.x + 8, p.y + 4, tw)) continue;
    g.fillStyle = 'rgba(200, 212, 235, 0.62)';
    g.fillText(text, p.x + 8, p.y + 4);
  }
}

function label(g, text, sub, x, y, color) {
  g.font = '600 13px "Chakra Petch", system-ui, sans-serif';
  g.fillStyle = color;
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 4;
  g.fillText(text, x, y);
  const tw = g.measureText(text).width;
  g.font = '500 11px "Chakra Petch", system-ui, sans-serif';
  g.globalAlpha = 0.75;
  g.fillText(sub, x + tw + 7, y);
  g.globalAlpha = 1;
  g.shadowBlur = 0;
}

// ---------- Helm ----------

function setTarget(i, aim = true) {
  if (i === state.at || !(i >= 0 && i < cat.count)) i = null;
  state.target = i;
  const name = $('target-name'), sub = $('target-sub');
  if (i == null) {
    name.textContent = 'Choose a star';
    sub.textContent = 'Tap a star on the viewscreen, or pick from the list';
  } else {
    const n = notesFor(cat, i);
    name.textContent = titleFor(cat, i);
    sub.textContent = n ? (n.aka ? `${n.aka} · ${shortKind(n.kind)}` : shortKind(n.kind)) : shortKind(describeKind(cat.spect[i], cat.temp[i]));
    if (aim) lookAt(starPos(i));
  }
  $('engage').disabled = i == null || !!trip;
  updateTrip();
  save();
  dirty = true;
}

const shortKind = k => k.split(',')[0];

function updateWarp() {
  const w = Number($('warp').value);
  state.warp = w;
  $('warp-out').textContent = w.toFixed(1).replace(/\.0$/, '');
  $('warp-speed').textContent = `${Math.round(warpSpeed(w)).toLocaleString('en-US')} × the speed of light`;
  $('warp').style.setProperty('--fill', `${(w - 1) / 8.9 * 100}%`);
  updateTrip();
}

function updateTrip() {
  const el = $('trip');
  if (state.target == null) { el.textContent = ''; return; }
  const ly = lyFromShip(state.target);
  el.innerHTML = `<b>${formatLy(ly)}</b> away · <b>${formatDuration(tripYears(ly, state.warp))}</b> at this warp · light takes ${formatDuration(ly)}`;
}

function updateHud() {
  const fromSol = Math.hypot(...camAbs()) * LY_PER_PC;
  const sd = `Stardate ${stardate()}`;
  if (trip) {
    $('status').textContent = trip.phase === 'drop' ? 'Dropping out of warp' : trip.phase === 'cruise' ? 'At warp' : 'Engaging';
    $('where').textContent = `En route to ${titleFor(cat, trip.i)}`;
  } else {
    $('status').textContent = 'Holding';
    $('where').textContent = state.at === 0 ? 'Earth orbit' : titleFor(cat, state.at);
  }
  $('when').innerHTML = `<span>${sd}</span> · <span>${fromSol < 0.001 ? 'Home' : `${formatLy(fromSol)} from Sol`}</span>`;
}

// ---------- Flight ----------

function engage() {
  const i = state.target;
  if (i == null || trip) return;
  const from = camAbs();
  const S = starPos(i);
  const to = S.map((v, k) => v - from[k]);
  const dStar = Math.hypot(...to);
  const dir = to.map(v => v / dStar);
  const hold = Math.min(holdAU(i) / AU_PER_PC, dStar * 0.5);
  const D = dStar - hold;
  const ly = dStar * LY_PER_PC;
  const a0 = Math.max(cat.distanceFrom(state.at, from), 1e-7);
  const heading = headingOf(dir);
  const cruise = (3.6 + 1.7 * Math.log10(1 + ly)) / speedUp;
  turn = null;
  trip = {
    i, from, S, dir, hold, D, ly, a0, cam: from.slice(),
    fromTitle: state.at === 0 ? 'Sol' : titleFor(cat, state.at),
    yaw0: state.yaw, pitch0: state.pitch, yaw1: nearestYaw(state.yaw, heading.yaw), pitch1: heading.pitch, fov0: state.fov,
    t0: performance.now(), align: 1.5 / speedUp, spool: 1.5 / speedUp, cruise, drop: 1.6 / speedUp,
    years: tripYears(ly, state.warp), warpFactor: state.warp, warp: 0, streak: 0, phase: 'align', rebased: false,
  };
  $('console').classList.add('away');
  $('engage').disabled = true;
  closeSheets();
  sound.blip(660);
  updateHud();
}

function along(t, T) {
  const half = T.D / 2;
  if (t < 0.5) return T.a0 * (Math.exp(Math.log(1 + half / T.a0) * 2 * t) - 1);
  return T.D - T.hold * (Math.exp(Math.log(1 + half / T.hold) * 2 * (1 - t)) - 1);
}

function fly(now) {
  const T = trip;
  const s = T.frozen ?? (now - T.t0) / 1000;
  const ease = x => x * x * (3 - 2 * x);
  const narrow = innerWidth < 760;
  let dist = 0;
  if (s < T.align) {
    const k = ease(s / T.align);
    state.yaw = T.yaw0 + (T.yaw1 - T.yaw0) * k;
    state.pitch = T.pitch0 + (T.pitch1 - T.pitch0) * k;
    state.fov = T.fov0 + (60 * DEG - T.fov0) * k;
    T.phase = 'align';
  } else if (s < T.align + T.spool) {
    const k = (s - T.align) / T.spool;
    if (T.phase !== 'spool') { T.phase = 'spool'; sound.engage(T.spool + T.cruise); updateHud(); }
    state.yaw = T.yaw1; state.pitch = T.pitch1;
    T.warp = k * k;
    T.streak = 6 + 40 * k * k;
    if (k > 0.82 && !T.flashed) { T.flashed = true; flash(0.85); }
  } else if (s < T.align + T.spool + T.cruise) {
    const t = (s - T.align - T.spool) / T.cruise;
    if (T.phase !== 'cruise') { T.phase = 'cruise'; updateHud(); }
    dist = along(t, T);
    T.warp = 1;
    T.streak = 46 + 90 * Math.pow(Math.sin(Math.PI * t), 0.6);
    if (t >= 0.5 && !T.rebased) { T.rebased = true; sky.setOrigin(T.S); }
    readout(t, dist);
  } else if (s < T.align + T.spool + T.cruise + T.drop) {
    const k = (s - T.align - T.spool - T.cruise) / T.drop;
    if (T.phase !== 'drop') {
      T.phase = 'drop';
      if (!T.rebased) { T.rebased = true; sky.setOrigin(T.S); }
      flash(0.7);
      sound.arrive();
      updateHud();
    }
    dist = T.D;
    T.warp = Math.max(0, 1 - k * 2.2);
    T.streak = 46 * (1 - k);
    // Settle the view so the star sits above the log on a phone.
    state.pitch = T.pitch1 - (narrow ? 0.34 * state.fov : 0) * ease(k);
    readout(1, dist);
  } else {
    arrive();
    return;
  }
  T.cam = T.from.map((v, k) => v + T.dir[k] * dist);
}

function readout(t, dist) {
  const T = trip;
  $('readout').hidden = false;
  $('readout-warp').textContent = `Warp ${T.warpFactor.toFixed(1).replace(/\.0$/, '')}`;
  $('readout-left').textContent = `${formatLy(Math.max(T.D + T.hold - dist, T.hold) * LY_PER_PC)} to go`;
  $('readout-time').textContent = `${formatDuration(T.years * t)} elapsed`;
  updateHud();
}

function arrive() {
  const T = trip;
  trip = null;
  state.at = T.i;
  state.offset = T.dir.map(v => -v * T.hold);
  state.target = null;
  // Face the star, sitting above the log on a phone.
  const h = headingOf(T.dir);
  state.yaw = h.yaw;
  state.pitch = clampPitch(h.pitch - (innerWidth < 760 ? 0.34 * state.fov : 0));
  sky.setOrigin(T.S);
  const entry = composeEntry(cat, T.i, { cam: camAbs(), holdAU: T.hold * AU_PER_PC, warp: T.warpFactor, fromTitle: T.fromTitle, tripLy: T.ly });
  state.log.unshift(entry);
  state.ly += T.ly;
  save();
  $('readout').hidden = true;
  $('console').classList.remove('away');
  setTarget(null, false);
  updateHud();
  showArrival(entry);
  dirty = true;
}

function flash(strength) {
  $('flash').animate([{ opacity: 0 }, { opacity: strength, offset: 0.25 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
}

// ---------- Looking around ----------

function headingOf(dir) {
  return { yaw: Math.atan2(dir[1], dir[0]), pitch: Math.asin(Math.max(-1, Math.min(1, dir[2]))) };
}

function nearestYaw(from, to) {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return from + d;
}

function lookAt(pos, duration = 1000) {
  if (trip) return;
  const cam = camAbs();
  const d = pos.map((v, k) => v - cam[k]);
  const l = Math.hypot(...d);
  const h = headingOf(d.map(v => v / l));
  turn = { t0: performance.now(), dur: duration, yaw0: state.yaw, pitch0: state.pitch, yaw1: nearestYaw(state.yaw, h.yaw), pitch1: Math.max(-1.5, Math.min(1.5, h.pitch)) };
}

function steer(now) {
  const k = Math.min(1, (now - turn.t0) / turn.dur);
  const e = 1 - Math.pow(1 - k, 3);
  state.yaw = turn.yaw0 + (turn.yaw1 - turn.yaw0) * e;
  state.pitch = turn.pitch0 + (turn.pitch1 - turn.pitch0) * e;
  dirty = true;
  if (k >= 1) { turn = null; save(); }
}

function lookHome() {
  closeSheets();
  if (Math.hypot(...camAbs()) < 0.002) { lookAt(starPos(0)); return; }
  lookAt(starPos(0), 1400);
  state.sunPulse = performance.now() + 1000;
}

// ---------- Sheets ----------

function openSheet(id) {
  closeSheets();
  $(id).hidden = false;
  $('scrim').hidden = false;
}

function closeSheets() {
  for (const id of ['picker', 'log', 'settings', 'arrival']) $(id).hidden = true;
  $('scrim').hidden = true;
}

function showArrival(entry) {
  $('arrival-date').textContent = `Captain’s log · Stardate ${entry.stardate}`;
  $('arrival-entry').innerHTML = entryHtml(entry, true);
  openSheet('arrival');
  $('scrim').hidden = true; // keep the view of the new star clear
  $('arrival-entry').scrollTop = 0;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function entryHtml(e, heading) {
  const parts = heading ? [`<h3>${esc(e.title)}</h3>`] : [];
  parts.push(`<p class="intro-line">${esc(e.intro)}</p><dl>`);
  let delay = 0;
  for (const [label, text] of e.sections) {
    const style = heading ? ` style="animation: rise .5s ${(delay += 0.12).toFixed(2)}s both"` : '';
    if (label) parts.push(`<dt${style}>${esc(label)}</dt>`);
    parts.push(`<dd class="${label ? (label === 'Looking home' ? 'home' : '') : 'note'}"${style}>${esc(text)}</dd>`);
    if (label === 'Planets') parts.push(surveyLinks(e.star, style));
  }
  parts.push('</dl>');
  return parts.join('');
}

// Links to the planetary survey's files on this star's planets.
function surveyLinks(i, style) {
  const files = filesForStar(cat.names[i]);
  if (!files.length) return '';
  return `<dd class="files"${style}>${files.map(({ world, cls }) =>
    `<a href="${SURVEY}#${encodeURIComponent(cls.id)}"${AWAY}>${esc(world.name)}: ${esc(classLabel(cls))}${cls.candidate ? ' candidate' : ''}</a>`).join('')}</dd>`;
}

function renderLog() {
  const n = new Set(state.log.map(e => e.star)).size;
  $('stats').textContent = state.log.length
    ? `${n} ${n === 1 ? 'star' : 'stars'} visited · ${formatLy(state.ly)} traveled`
    : 'Nothing logged yet. Choose a star and engage.';
  $('entries').innerHTML = state.log.map(e => `
    <details class="past">
      <summary><b>${esc(e.title)}</b><span class="sd">${esc(e.stardate)}</span><span>${esc(e.intro)}</span></summary>
      <div class="entry">${entryHtml(e, false)}</div>
    </details>`).join('');
}

const fold = s => s.toLowerCase().replace(/[α-ω]/g, c => GREEK[c] + ' ').normalize('NFD').replace(/[̀-ͯ’']/g, '').replace(/\s+/g, ' ').trim();
let searchIndex = null;

function renderList() {
  const q = fold($('search').value);
  const cam = camAbs();
  const visited = new Set(state.log.map(e => e.star));
  const row = (i, meta) => {
    const n = notesFor(cat, i);
    const badges = [n?.worlds ? 'planets' : '', visited.has(i) ? 'visited' : ''].filter(Boolean).join(' · ');
    const here = i === state.at;
    return `<button class="row${here ? ' here' : ''}" type="button" data-star="${i}" ${here ? 'disabled' : ''}>
      <span class="name">${esc(titleFor(cat, i))}${badges ? `<span class="badge">${badges}</span>` : ''}</span>
      <span class="dist">${here ? 'You’re here' : formatLy(cat.distanceFrom(i, cam) * LY_PER_PC)}</span>
      <span class="meta">${esc(meta)}</span></button>`;
  };
  const metaFor = i => {
    const n = notesFor(cat, i);
    if (n) return n.aka ? `${n.aka} · ${shortKind(n.kind)}` : shortKind(n.kind);
    return shortKind(describeKind(cat.spect[i], cat.temp[i]));
  };
  let html = '';
  if (!q) {
    html += `<p class="group">Home</p>${row(0, 'The Sun · Earth orbit')}`;
    for (const [group, title] of GROUPS) {
      const stars = DESTINATIONS.filter(d => d.group === group).map(d => cat.byName.get(d.star)).filter(i => i !== undefined);
      stars.sort((a, b) => cat.distanceFrom(a, cam) - cat.distanceFrom(b, cam));
      html += `<p class="group">${title}</p>` + stars.map(i => row(i, metaFor(i))).join('');
    }
  } else {
    if (!searchIndex) {
      searchIndex = cat.names.map((n, i) => {
        const d = notesFor(cat, i);
        return fold([n, d?.title, d?.aka].filter(Boolean).join(' | '));
      });
    }
    const hits = [];
    for (let i = 0; i < cat.count; i++) {
      const at = searchIndex[i].indexOf(q);
      if (at < 0) continue;
      const curated = notesFor(cat, i) ? 0 : 1;
      const m = apparentMag(cat.absmag[i], Math.max(Math.hypot(...starPos(i)), 1e-6));
      hits.push([curated, at === 0 ? 0 : 1, m, i]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    html = hits.length ? hits.slice(0, 60).map(h => row(h[3], metaFor(h[3]))).join('') : '<p class="empty">No star by that name in the catalogue.</p>';
  }
  $('list').innerHTML = html;
}

// ---------- Input ----------

function bind() {
  $('warp').addEventListener('input', () => { updateWarp(); save(); });
  $('engage').addEventListener('click', engage);
  $('choose').addEventListener('click', () => { $('search').value = ''; renderList(); openSheet('picker'); $('list').scrollTop = 0; });
  $('search').addEventListener('input', renderList);
  $('list').addEventListener('click', e => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    sound.blip(990);
    closeSheets();
    setTarget(Number(b.dataset.star));
  });
  $('open-log').addEventListener('click', () => { renderLog(); openSheet('log'); });
  $('open-settings').addEventListener('click', () => openSheet('settings'));
  $('look-home').addEventListener('click', lookHome);
  $('arrival-home').addEventListener('click', lookHome);
  $('arrival-next').addEventListener('click', () => { $('search').value = ''; renderList(); openSheet('picker'); });
  $('scrim').addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
  $('intro-go').addEventListener('click', () => {
    $('intro').hidden = true;
    state.seenIntro = true;
    save();
    sound.blip(880);
  });
  for (const [id, key] of [['opt-lines', 'lines'], ['opt-labels', 'labels'], ['opt-sound', 'sound']]) {
    $(id).addEventListener('change', e => {
      state.opts[key] = e.target.checked;
      sound.on = state.opts.sound;
      sound.stop();
      save();
      dirty = true;
    });
  }
  // Two taps, asked on the button itself (the Artifact viewer refuses confirm dialogs).
  $('clear-log').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = 'Tap again to clear the log';
      setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear the log and return to Earth'; }, 4000);
      return;
    }
    delete b.dataset.armed;
    b.textContent = 'Clear the log and return to Earth';
    const keep = { opts: state.opts, seenIntro: true, warp: state.warp };
    Object.assign(state, defaults(), keep);
    sky.setOrigin(starPos(0));
    setTarget(null, false);
    updateHud();
    closeSheets();
    save();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheets();
    if (e.target.closest('input, button') || trip) return;
    const step = state.fov * 0.08;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      state.yaw += moves[e.key][0];
      state.pitch = clampPitch(state.pitch + moves[e.key][1]);
      dirty = true;
      e.preventDefault();
    }
  });
  addEventListener('resize', () => { dirty = true; });

  // Drag to look around, pinch or scroll to zoom, tap to pick a star.
  const view = $('labels');
  const pts = new Map();
  let drag = null, pinch = null;
  view.addEventListener('pointerdown', e => {
    view.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, moved: false };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: state.fov }; drag = null; }
  });
  view.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || trip) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      setFov(pinch.fov * pinch.d / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1));
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.moved = true;
    view.classList.add('dragging');
    turn = null;
    const radPerPx = 1 / (sky.focal(state.fov) / sky.dpr);
    state.yaw += (e.clientX - prev.x) * radPerPx;
    state.pitch = clampPitch(state.pitch + (e.clientY - prev.y) * radPerPx);
    dirty = true;
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    view.classList.remove('dragging');
    if (pts.size < 2) pinch = null;
    if (drag && !drag.moved && !trip && pts.size === 0) {
      const r = view.getBoundingClientRect();
      const i = sky.pick(e.clientX - r.left, e.clientY - r.top, 6.5 + Math.max(0, Math.log2(60 * DEG / state.fov)));
      if (i > 0 || (i === 0 && state.at !== 0)) { sound.blip(990); setTarget(i, false); }
    }
    if (drag?.moved) save();
    drag = null;
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', e => { e.preventDefault(); if (!trip) setFov(state.fov * Math.exp(e.deltaY * 0.0012)); }, { passive: false });
}

const clampPitch = p => Math.max(-89 * DEG, Math.min(89 * DEG, p));

function setFov(f) {
  state.fov = Math.max(2 * DEG, Math.min(100 * DEG, f));
  dirty = true;
}

// ---------- Hooks for tests and screenshots ----------

function hooks() {
  return {
    state, get trip() { return trip; }, cat: () => cat,
    speed(x) { speedUp = x; },
    find: name => cat.byName.get(name) ?? DESTINATIONS.find(d => d.title === name && cat.byName.get(d.star)),
    target(name) { setTarget(cat.byName.get(name)); },
    // Puts the ship at a star at once, as if it had flown there from where it was.
    jump(name, warp = state.warp) {
      const i = cat.byName.get(name);
      const from = camAbs(), S = starPos(i);
      const to = S.map((v, k) => v - from[k]), d = Math.hypot(...to), dir = to.map(v => v / d);
      trip = { i, S, dir, hold: Math.min(holdAU(i) / AU_PER_PC, d / 2), ly: d * LY_PER_PC, warpFactor: warp, fromTitle: state.at === 0 ? 'Sol' : titleFor(cat, state.at), cam: from };
      arrive();
    },
    look(yawDeg, pitchDeg, fovDeg) { turn = null; state.yaw = yawDeg * DEG; state.pitch = pitchDeg * DEG; if (fovDeg) state.fov = fovDeg * DEG; dirty = true; },
    lookAtStar(name) { const i = cat.byName.get(name); lookAt(starPos(i), 1); },
    lookHome,
    // Starts a trip and holds it at fraction t of the cruise, for pictures of the ship at warp.
    freeze(name, t) {
      setTarget(cat.byName.get(name), false);
      engage();
      trip.frozen = trip.align + trip.spool + trip.cruise * t;
      fly(performance.now());
      state.yaw = trip.yaw1; state.pitch = trip.pitch1; state.fov = 60 * DEG;
    },
    redraw() { dirty = true; },
    // Draws now and returns the viewscreen as an image (the drawing buffer is cleared once it's on screen).
    snapshot() { sky.render(viewNow(0)); return $('sky').toDataURL('image/png'); },
    closeSheets,
  };
}

start();
