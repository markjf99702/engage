// The xenobiology lab: pick a planet class, grow a creature for it, read how the world shaped it, and keep the ones you like.
import { CLASSES, byId, label } from './classes.js';
import { Globe, paint } from './planet-art.js';
import { grow, ODDS } from './xeno-gen.js';
import { drawScene } from './xeno-art.js';
import { SPECIMENS, specimensFor } from './species.js';

const KEY = 'engage.xeno.v1';
// Where Engage itself is. The single-file copy points this at the live site.
const BRIDGE = './';
const AWAY = BRIDGE.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const still = matchMedia('(prefers-reduced-motion: reduce)');
const order = CLASSES;
const SEEDS = { earth: 3, forest: 2, mars: 1, desert: 1, venus: 1, ocean: 2, ice: 1, rock: 2, demon: 1, jovian: 1, ultra: 1, rogue: 1, superearth: 1, subneptune: 1, lava: 1, hotjupiter: 1, icegiant: 4 };
const ODDS_HEAD = { likely: 'Plausible', possible: 'Possible', long: 'A long shot', wild: 'Pure speculation' };

const saved = load();
let current = null; // the creature in the tank
let born = 0; // when it started growing
const tank = $('tank');
const tg = tank.getContext('2d');

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* start again */ }
  const jars = Array.isArray(s.jars) ? s.jars.filter(j => j && byId.has(j.id) && Number.isInteger(j.seed)) : [];
  return { ...s, jars };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* fine */ } }

const newSeed = () => 1 + Math.floor(Math.random() * 9999);

// ---------- Growing ----------

function show(id, seed = newSeed(), animate = true) {
  current = grow(id, seed);
  born = animate && !still.matches ? performance.now() : -1e9;
  const c = current;
  $('tank-tag').textContent = `${label(c.cls)} · Specimen ${String(seed).padStart(4, '0')}`;
  $('specimen').innerHTML = cardHtml(c);
  renderKeep();
  renderRefs(id);
  document.querySelectorAll('#strip .chip').forEach(b => {
    const on = b.dataset.id === id;
    b.setAttribute('aria-current', on ? 'true' : 'false');
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: still.matches ? 'auto' : 'smooth' });
  });
  try { history.replaceState(null, '', `#${id}-${seed}`); } catch { /* fine */ }
  if (still.matches) frame(performance.now());
}

function cardHtml(c) {
  const plantOnly = c.classId === 'L';
  return `
    <p class="eyebrow">Specimen grown for ${esc(label(c.cls))}${c.cls.letter ? ` · ${esc(c.cls.name)}` : ''}</p>
    <h2>${esc(c.name.common)}</h2>
    <p class="latin">${esc(c.name.genus)} ${esc(c.name.species)}</p>
    <p class="odds"><b>${ODDS_HEAD[c.odds]}.</b> ${esc(ODDS[c.odds].replace(/^[^.]+\. /, ''))}</p>
    ${plantOnly ? '<p class="aside">Class L worlds have plant life and no animals, so the lab grew a plant.</p>' : ''}
    <ul class="notes">${c.notes.map(n => `<li><h3>${esc(n.label)}</h3><p>${esc(n.text)}</p></li>`).join('')}</ul>
    <a class="to-file" href="${BRIDGE}survey.html#${esc(c.classId)}"${AWAY}>Read the ${esc(label(c.cls))} survey file <span aria-hidden="true">→</span></a>
  `;
}

// ---------- The tank ----------

function size() {
  const r = tank.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (tank.width !== w || tank.height !== h) { tank.width = w; tank.height = h; }
  return { w: r.width, h: r.height, dpr };
}

function frame(now) {
  if (!current) return;
  const { w, h, dpr } = size();
  if (!w) return;
  tg.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t = still.matches ? 0 : now / 1000;
  const grown = Math.min(1, (now - born) / 1400);
  drawScene(tg, current, w, h, t, grown);
}

function loop(now) {
  if (!still.matches && !document.hidden) frame(now);
  requestAnimationFrame(loop);
}

// ---------- Reference specimens ----------

function refHtml(s) {
  const cls = byId.get(s.cls);
  return `<li><div class="ref-head"><b>${esc(s.name)}</b><span class="ref-kind ${s.kind}">${s.kind === 'trek' ? 'Star Trek' : 'Earth'}</span></div>
    <p class="ref-home">${esc(s.home)} · ${esc(label(cls))}</p><p>${esc(s.note)}</p></li>`;
}

function renderRefs(id) {
  const list = specimensFor(id);
  const c = byId.get(id);
  $('refs-sub').textContent = list.length
    ? `Life from Star Trek and from Earth that helps explain ${label(c)}.`
    : `Nothing on file for ${label(c)} yet.`;
  $('refs').innerHTML = list.map(refHtml).join('');
}

// ---------- Jars ----------

function renderKeep() {
  const kept = current && saved.jars.some(j => j.id === current.classId && j.seed === current.seed);
  $('keep').textContent = kept ? 'In a jar' : 'Keep in a jar';
  $('keep').setAttribute('aria-pressed', kept ? 'true' : 'false');
}

function toggleKeep() {
  if (!current) return;
  const i = saved.jars.findIndex(j => j.id === current.classId && j.seed === current.seed);
  if (i >= 0) saved.jars.splice(i, 1);
  else saved.jars.unshift({ id: current.classId, seed: current.seed });
  saved.jars = saved.jars.slice(0, 40);
  save();
  renderKeep();
  renderJars();
}

function renderJars() {
  const list = saved.jars.filter(j => byId.has(j.id));
  $('jars-wrap').hidden = !list.length;
  $('jars').innerHTML = list.map((j, k) => {
    const c = grow(j.id, j.seed);
    return `<li class="jar"><button class="jar-open" type="button" data-k="${k}"><canvas width="300" height="225" aria-hidden="true"></canvas>
      <span class="jar-name">${esc(c.name.common)}</span><span class="jar-cls">${esc(label(c.cls))}</span></button>
      <button class="jar-drop" type="button" data-drop="${k}" aria-label="Let the ${esc(c.name.common)} go">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`;
  }).join('');
  $('jars').querySelectorAll('.jar-open canvas').forEach((cv, k) => {
    const g = cv.getContext('2d');
    drawScene(g, grow(list[k].id, list[k].seed), cv.width, cv.height, 0, 1);
  });
}

// ---------- Planet strip ----------

function buildStrip() {
  const strip = $('strip');
  let html = '';
  order.forEach((c, k) => {
    if (k === 0) html += '<p class="strip-group">Starfleet</p>';
    if (!c.letter && order[k - 1]?.letter) html += '<p class="strip-group">Real, unnamed</p>';
    html += `<button class="chip" type="button" data-id="${esc(c.id)}" aria-label="${esc(label(c))}: ${esc(c.short)}">
      <canvas width="96" height="96" aria-hidden="true"></canvas><span>${esc(c.letter || c.name)}</span></button>`;
  });
  strip.innerHTML = html;
  strip.addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (b) show(b.dataset.id);
  });
  const chips = [...strip.querySelectorAll('.chip canvas')];
  let k = 0;
  const next = () => {
    const end = performance.now() + 12;
    while (k < chips.length && performance.now() < end) {
      const c = order[k];
      const g = new Globe(chips[k]);
      g.setMap(paint(c.art, SEEDS[c.art] || 1, 128));
      g.draw(0.8, 96);
      k++;
    }
    if (k < chips.length) setTimeout(next, 0);
  };
  setTimeout(next, 30);
}

// ---------- Start ----------

function fromHash() {
  const m = decodeURIComponent(location.hash.slice(1)).match(/^(.+?)(?:-(\d{1,4}))?$/);
  if (m && byId.has(m[1])) return { id: m[1], seed: m[2] ? Number(m[2]) : newSeed() };
  return null;
}

buildStrip();
$('cabinet').innerHTML = SPECIMENS.map(refHtml).join('');
$('again').addEventListener('click', () => show(current.classId));
$('keep').addEventListener('click', toggleKeep);
$('jars').addEventListener('click', e => {
  const drop = e.target.closest('[data-drop]');
  const list = saved.jars.filter(j => byId.has(j.id));
  if (drop) {
    const j = list[Number(drop.dataset.drop)];
    saved.jars = saved.jars.filter(x => x !== j);
    save(); renderJars(); renderKeep();
    return;
  }
  const open = e.target.closest('[data-k]');
  if (open) {
    const j = list[Number(open.dataset.k)];
    show(j.id, j.seed);
    $('tank').scrollIntoView({ block: 'center', behavior: still.matches ? 'auto' : 'smooth' });
  }
});
window.addEventListener('hashchange', () => {
  const h = fromHash();
  if (h && (!current || h.id !== current.classId || h.seed !== current.seed)) show(h.id, h.seed);
});
window.addEventListener('resize', () => { if (still.matches) frame(performance.now()); });
still.addEventListener?.('change', () => frame(performance.now()));

window.xeno = { show, get current() { return current; }, get jars() { return saved.jars; } };

const start = fromHash() || { id: 'M', seed: newSeed() };
show(start.id, start.seed);
renderJars();
requestAnimationFrame(loop);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
