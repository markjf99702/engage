// First contact: the page. The rules and the language are in contact-sim.js and the viewscreen in contact-art.js;
// this plays each exchange out, keeps the notebook and the reply, and writes the debrief and the record.
import { newGame, act, debrief, hint, phrase, MEANINGS, MEANING, MAX_REPLY, PATIENCE } from './contact-sim.js';
import { species, drawScreen } from './contact-art.js';
import { sound } from './audio.js';

const KEY = 'engage.contact.v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const still = matchMedia('(prefers-reduced-motion: reduce)');
const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const saved = load();
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* start a new record */ }
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
  const runs = Array.isArray(s.runs) ? s.runs.filter(r => r && typeof r === 'object' && typeof r.title === 'string') : [];
  return { ...s, runs };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* fine */ } }
try { sound.on = JSON.parse(localStorage.getItem('engage.v1') || '{}')?.opts?.sound !== false; } catch { /* keep it on */ }

let g = null; // the encounter
let look = null; // how this species looks
let reply = []; // phrase ids in the reply being put together
let shown = 0; // log lines on screen so far
let busy = false;
let speakingUntil = 0;
let lastEval = null;

// ---------- Screens ----------

function showScreen(name) {
  for (const s of ['brief', 'sim', 'eval']) $(s).hidden = s !== name;
  scrollTo(0, 0);
  if (name === 'sim') { sizeScreen(); loop(); }
}

function showBrief() {
  const runs = saved.runs.slice(-8).reverse();
  $('record').hidden = !runs.length;
  $('runs').innerHTML = runs.map(r => `<li><b>${esc(r.title)}</b><span class="when">${esc(new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span>
    <span class="what">The ${esc(r.people || 'unknown ship')} · ${Number(r.decoded) || 0} of ${Number(r.of) || 0} phrases decoded</span></li>`).join('');
  showScreen('brief');
}

function start(seed = Date.now()) {
  g = newGame({ seed });
  look = species(g.lang.look);
  reply = [];
  shown = 0;
  logged = 0;
  lastEval = null;
  $('comms').innerHTML = '';
  $('subtitle').innerHTML = '';
  showScreen('sim');
  play(g.log.slice());
}

// ---------- Each exchange ----------

function play(lines) {
  busy = true;
  update();
  const fast = still.matches;
  let t = 0;
  for (const l of lines) {
    setTimeout(() => {
      shown = Math.min(g.log.length, g.log.indexOf(l) + 1);
      renderLog();
      if (l.who === 'them') speak(l);
      if (l.tone === 'bad') sound.blip(330);
    }, t);
    if (!fast) t += l.who === 'them' ? 300 + 450 * l.ids.length : 650;
  }
  setTimeout(() => {
    shown = g.log.length;
    busy = false;
    renderLog();
    update();
    if (g.over) record();
  }, fast ? 0 : t + 200);
}

// Their captain says a line: subtitles, a moving mouth and a few tones.
function speak(l) {
  $('subtitle').innerHTML = `${l.ids.length ? `<p class="said">${l.ids.map(id => `“${esc(phrase(g, id))}”`).join(' ')}</p>` : ''}<p class="act">${esc(l.act)}</p>`;
  speakingUntil = performance.now() + (still.matches ? 0 : 500 * Math.max(1, l.ids.length));
  l.ids.forEach((id, i) => setTimeout(() => sound.blip(420 + ((id.charCodeAt(0) * 37 + id.length * 11) % 400)), i * 260));
}

function send() {
  if (busy || !g || g.over || !reply.length) return;
  const said = reply;
  reply = [];
  play(act(g, { say: said }));
}

function doAct(what) {
  if (busy || !g || g.over) return;
  play(act(g, what));
}

function update() {
  const over = !!(g && g.over);
  $('patience').innerHTML = Array.from({ length: PATIENCE }, (_, i) => `<i${i >= g.patience ? ' class="gone"' : ''}></i>`).join('');
  $('patience').setAttribute('aria-label', `Their patience: ${g.patience} of ${PATIENCE}`);
  $('who-tag').textContent = over ? (g.over === 'contact' ? `The ${g.lang.people}` : 'Channel closed') : 'Unknown vessel';
  document.querySelector('.side').classList.toggle('busy', busy);
  $('shields').textContent = g.shields ? 'Lower shields' : 'Raise shields';
  $('shields').setAttribute('aria-pressed', String(g.shields));
  for (const id of ['listen', 'standard', 'shields', 'leave']) $(id).disabled = over;
  if (over) {
    $('send').disabled = busy;
    $('send').textContent = 'Read the debrief';
  } else {
    $('send').textContent = 'Send';
    $('send').disabled = busy || !reply.length;
  }
  renderReply();
  renderBook();
}

function renderReply() {
  $('reply').innerHTML = reply.map((id, i) => `<li><span class="t">“${esc(phrase(g, id))}”${g.tags[id] ? `<small>${esc(MEANING[g.tags[id]])}?</small>` : ''}</span>
    <button type="button" data-i="${i}" aria-label="Take it out">${X}</button></li>`).join('');
  $('reply-empty').hidden = reply.length > 0 || g.over;
  $('clear').hidden = reply.length < 2;
}

let bookSize = 0;
function renderBook() {
  // Only what's been heard on screen so far, so new phrases turn up as they're said.
  const said = new Set(g.log.slice(0, shown).flatMap(l => (l.who === 'them' ? l.ids : [])));
  const heard = g.heard.filter(id => id !== 'story' && said.has(id));
  const count = id => g.log.slice(0, shown).reduce((n, l) => n + (l.who === 'them' ? l.ids.filter(x => x === id).length : 0), 0);
  const full = reply.length >= MAX_REPLY || g.over || busy;
  const opts = `<option value="">What does it mean?</option>${MEANINGS.map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('')}`;
  $('book').innerHTML = heard.map((id, i) => `<li${i >= bookSize && bookSize ? ' class="new"' : ''}>
    <button class="ph-add" type="button" data-i="${i}"${full || reply.includes(id) ? ' disabled' : ''}><span class="t">“${esc(phrase(g, id))}”</span><span class="plus">${reply.includes(id) ? 'In reply' : 'Say it'}</span></button>
    <select data-i="${i}" aria-label="What “${esc(phrase(g, id))}” means"${g.tags[id] ? ' class="tagged"' : ''}>${opts}</select>
    <span class="ph-n">heard ${count(id)}×</span></li>`).join('');
  $('book').querySelectorAll('select').forEach(s => { s.value = g.tags[heard[+s.dataset.i]] || ''; });
  $('book').dataset.ids = heard.join(' ');
  bookSize = heard.length;
  const tagged = heard.filter(id => g.tags[id]).length;
  $('book-n').textContent = heard.length ? `${tagged} of ${heard.length} guessed` : '';
}
const bookIds = () => ($('book').dataset.ids || '').split(' ').filter(Boolean);

let logged = 0;
function renderLog() {
  const box = $('comms');
  const fresh = i => (i >= logged ? ' fresh' : '');
  const tag = id => (g.tags[id] ? `<small>${esc(MEANING[g.tags[id]])}?</small>` : '');
  box.innerHTML = g.log.slice(0, shown).map((l, i) => {
    if (l.ids) {
      const who = l.who === 'them' ? 'Their captain' : 'You';
      const words = l.ids.map(id => `<span class="ph">“${esc(phrase(g, id))}”${id === 'story' ? '' : tag(id)}</span>`).join(' ');
      return `<p class="line ${l.who}${fresh(i)}"><span class="who">${who}</span>${words}${l.act ? `<span class="act">${esc(l.act)}</span>` : ''}</p>`;
    }
    return `<p class="line${l.tone ? ` ${l.tone}` : ''}${fresh(i)}"><span class="who">${esc(l.who)}</span>${esc(l.text)}</p>`;
  }).join('');
  logged = shown;
  box.scrollTop = box.scrollHeight;
  renderBook();
}

// ---------- Debrief and the record ----------

function record() {
  lastEval = debrief(g);
  saved.runs.push({ title: lastEval.title, outcome: lastEval.outcome, people: lastEval.people, decoded: lastEval.decoded, of: lastEval.of, at: new Date().toISOString() });
  saved.runs = saved.runs.slice(-30);
  save();
}

function showEval() {
  const e = lastEval || debrief(g);
  $('eval-title').textContent = e.title;
  $('eval-summary').textContent = e.summary;
  $('eval-story').hidden = !e.story;
  $('eval-story').innerHTML = e.story ? `“${esc(e.story)}”<small>Their new phrase for the day you met.</small>` : '';
  const note = e.decoded === e.of && e.of ? 'Every phrase right. Hoshi Sato would be proud.'
    : e.decoded ? 'From your notebook, against what they really meant.' : 'You didn’t write any right guesses in the notebook. Here’s what they were saying.';
  $('eval-score').innerHTML = `<span class="n">${e.decoded}/${e.of}</span><b>${esc(e.fluency)}</b><span>${esc(note)}</span>`;
  $('dict').innerHTML = e.rows.map(r => `<li class="${r.right ? 'right' : r.guess ? 'wrong' : 'blank'}"><span class="mark" aria-hidden="true">${r.right ? '✓' : r.guess ? '✗' : '–'}</span>
    <span class="t">“${esc(r.text)}”</span>
    <span class="m">meant <b>${esc(r.meaning)}</b>${r.guess && !r.right ? `, you guessed ${esc(MEANING[r.guess])}` : ''}${!r.guess ? ', no guess' : ''}</span></li>`).join('');
  $('transcript').innerHTML = e.transcript.map(t => `<li class="${t.who}"><span class="who">${t.who === 'them' ? 'Their captain' : 'You'}</span>
    <span class="meant">${esc(t.meant.join('. '))}.</span><br><span class="said">${t.said.map(s => `“${esc(s)}”`).join(' ')}</span></li>`).join('');
  showScreen('eval');
}

// ---------- The viewscreen ----------

const canvas = $('screen');
const cx = canvas.getContext('2d');
let W = 0, H = 0;
function sizeScreen() {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  W = r.width; H = r.height;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', () => { if (!$('sim').hidden) sizeScreen(); });

function screenState(now) {
  const said = g.log.slice(0, shown).filter(l => l.who === 'them');
  const last = said[said.length - 1];
  const ids = last ? last.ids : [];
  const mood = ids.includes('fight') ? 'wary' : (ids.includes('yes') || ids.includes('story')) ? 'glad' : 'calm';
  const closed = !!g.over && g.over !== 'contact' && shown >= g.log.length;
  const pic = !g.over && g.beat >= 1 && g.beat <= 4 && said.some(l => l.ids.includes('danger')) ? g.lang.danger : null;
  return { speaking: Math.max(0, Math.min(1, (speakingUntil - now) / 300)), mood, pic, closed };
}

let looping = false;
function loop() {
  if (looping) return;
  looping = true;
  const frame = now => {
    if ($('sim').hidden || document.hidden || !g) { looping = false; return; }
    if (W) drawScreen(cx, W, H, look, screenState(now), still.matches ? 0 : now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('sim').hidden) loop(); });

// ---------- Wiring ----------

$('start').addEventListener('click', () => start());
$('again').addEventListener('click', showBrief);
$('send').addEventListener('click', () => (g && g.over ? showEval() : send()));
$('clear').addEventListener('click', () => { reply = []; update(); });
$('listen').addEventListener('click', () => doAct('listen'));
$('standard').addEventListener('click', () => doAct('standard'));
$('shields').addEventListener('click', () => doAct('shields'));
$('leave').addEventListener('click', () => doAct('leave'));
$('reply').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]');
  if (!b || busy) return;
  reply.splice(+b.dataset.i, 1);
  update();
});
$('book').addEventListener('click', e => {
  const b = e.target.closest('.ph-add');
  if (!b || b.disabled || busy) return;
  const id = bookIds()[+b.dataset.i];
  if (id && !reply.includes(id) && reply.length < MAX_REPLY) reply.push(id);
  update();
});
$('book').addEventListener('change', e => {
  const s = e.target.closest('select');
  if (!s) return;
  const id = bookIds()[+s.dataset.i];
  if (!id) return;
  if (s.value) g.tags[id] = s.value; else delete g.tags[id];
  renderLog();
  renderReply();
});

showBrief();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.contact = {
  get game() { return g; }, get busy() { return busy; },
  start, send, act: doAct, showEval,
  // Puts phrases in the reply by meaning, as if tapped in the notebook.
  pick(...ids) { for (const id of ids) if (g.heard.includes(id) && !reply.includes(id) && reply.length < MAX_REPLY) reply.push(id); update(); },
  hint: () => hint(g),
  tag(id, guess) { if (guess) g.tags[id] = guess; else delete g.tags[id]; renderLog(); renderReply(); },
  debrief: () => debrief(g),
};
