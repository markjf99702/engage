// The Kobayashi Maru: the page. The rules are in maru-sim.js; this draws the tactical display, plays each turn out and keeps the record.
import { newGame, orders, act, evaluate, CREW, MARU } from './maru-sim.js';
import { sound } from './audio.js';

const KEY = 'engage.maru.v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const still = matchMedia('(prefers-reduced-motion: reduce)');

const saved = load();
function load() {
  try { return { runs: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { runs: [] }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* fine */ } }
try { sound.on = JSON.parse(localStorage.getItem('engage.v1') || '{}')?.opts?.sound !== false; } catch { /* keep it on */ }

let g = null; // the game
let busy = false;

// ---------- Screens ----------

function showScreen(name) {
  for (const s of ['brief', 'sim', 'eval']) $(s).hidden = s !== name;
  document.body.classList.toggle('red', name === 'sim' && g && g.klingons.length > 0 && !g.over);
  scrollTo(0, 0);
  if (name === 'sim') { sizePlot(); loop(); }
}

function showBrief() {
  const runs = saved.runs.slice(-8).reverse();
  $('record').hidden = !runs.length;
  $('rewrite').hidden = !runs.length;
  $('runs').innerHTML = runs.map(r => `<li><b>${esc(r.title)}</b><span class="when">${esc(new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span>
    <span class="letters">${r.grades.map(x => `${esc(x.name)} ${esc(x.letter)}`).join(' · ')}</span></li>`).join('');
  showScreen('brief');
}

function start(rewritten = false) {
  g = newGame({ rewritten });
  scene.reset();
  $('comms').innerHTML = '';
  $('caption').innerHTML = '';
  log([{ who: 'Communications', text: rewritten
    ? 'Simulator code amended. Distress call from the Kobayashi Maru, inside the Neutral Zone.'
    : 'Distress call on the emergency channel: the Kobayashi Maru, inside the Neutral Zone.', tone: 'bad' }]);
  showScreen('sim');
  update();
}

// ---------- Turns ----------

function update() {
  const inZone = g.where === 'zone';
  $('turn').textContent = g.over ? 'Simulation ended' : `Turn ${g.turn + 1} · ${inZone ? 'Inside the Neutral Zone' : 'Federation space'}`;
  $('alert').hidden = !(g.klingons.some(k => k.hull > 0) && !g.over);
  document.body.classList.toggle('red', !$('alert').hidden);
  $('hull').textContent = `${g.hull}%`;
  $('shields').textContent = `${g.shields}%`;
  $('hull-bar').style.width = `${g.hull}%`;
  $('shields-bar').style.width = `${g.shields}%`;
  $('hull-bar').classList.toggle('low', g.hull < 35);
  $('shields-bar').classList.toggle('low', g.shields < 25);
  $('maru-left').textContent = g.maru.gone ? 'Lost' : `${g.maru.aboard}`;
  $('rescued').textContent = `${g.aboard}`;

  const box = $('orders');
  box.classList.remove('busy');
  if (g.over) {
    box.innerHTML = '<button class="primary" id="read-eval" type="button">Read your evaluation</button>';
    $('read-eval').addEventListener('click', showEval);
    return;
  }
  box.innerHTML = orders(g).map(o => `<button class="order${o.primary ? ' primary-order' : ''}${o.danger ? ' danger' : ''}" type="button" data-id="${o.id}"${o.done ? ' disabled' : ''}>
    <b>${esc(o.label)}</b><span>${esc(o.sub)}</span></button>`).join('');
}

function give(id) {
  if (busy || !g || g.over) return;
  const turn = g.turn + 1;
  const { events, lines } = act(g, id);
  if (!lines.length && !events.length) return;
  busy = true;
  $('orders').classList.add('busy');
  log([{ mark: `Turn ${turn}` }]);
  const took = scene.play(events);
  // Spread the messages over the turn so they land with what they describe.
  const gap = Math.min(700, took / Math.max(1, lines.length));
  lines.forEach((l, i) => setTimeout(() => log([l]), still.matches ? 0 : i * gap));
  setTimeout(() => {
    busy = false;
    update();
    if (g.over) record();
  }, still.matches ? 150 : took + 250);
}

function log(lines) {
  const box = $('comms');
  for (const l of lines) {
    const p = document.createElement('p');
    if (l.mark) { p.className = 'line turn-mark'; p.textContent = l.mark; }
    else {
      p.className = `line${l.tone ? ` ${l.tone}` : ''}`;
      p.innerHTML = `<span class="who">${esc(l.who)}</span>${esc(l.text)}`;
    }
    box.append(p);
    if (!l.mark) $('caption').innerHTML = p.innerHTML;
    $('caption').className = `caption${l.tone ? ` ${l.tone}` : ''}`;
  }
  box.scrollTop = box.scrollHeight;
}

// ---------- Evaluation and the record ----------

let lastEval = null;
function record() {
  lastEval = evaluate(g);
  saved.runs.push({ title: lastEval.title, outcome: lastEval.outcome, grades: lastEval.grades.map(x => ({ name: x.name, letter: x.letter })), at: new Date().toISOString() });
  saved.runs = saved.runs.slice(-30);
  save();
}

function showEval() {
  const e = lastEval || evaluate(g);
  $('eval-title').textContent = e.title;
  $('eval-summary').textContent = e.summary;
  $('grades').innerHTML = e.grades.map(x => `<div class="grade ${x.letter}"><span class="l">${x.letter}</span><span class="n">${esc(x.name)}</span><span class="w">${esc(x.why)}</span></div>`).join('');
  $('eval-note').innerHTML = e.note.map(n => `<p>${esc(n)}</p>`).join('');
  showScreen('eval');
}

// ---------- The tactical display ----------

// The frame is 1000 units wide on a big screen and narrower on a phone, so ships and labels stay readable.
let W = 1000;
const canvas = $('plot');
const cx = canvas.getContext('2d');
let H = 800, dpr = 1;

function sizePlot() {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  W = Math.round(Math.max(560, Math.min(1000, r.width * 1.45)));
  H = W * r.height / r.width;
}
addEventListener('resize', () => { if (!$('sim').hidden) sizePlot(); });

// Where things sit, in a frame 1000 wide.
const at = {
  zone: () => W * 0.36,
  maru: () => ({ x: W * 0.68, y: H * 0.44 }),
  start: () => ({ x: W * 0.15, y: H * 0.6 }),
  near: () => ({ x: W * 0.5, y: H * 0.6 }),
  slot(i) {
    const A = [-35, 35, 80, -80, 5, 120, -125, 58, -12, 150, -58, 100][i % 12] * Math.PI / 180;
    const m = at.maru(), r = (i % 2 ? 0.25 : 0.21) * Math.min(W, H * 1.25) + (i >= 12 ? 40 : 0);
    return { x: Math.max(40, Math.min(W - 40, m.x + Math.cos(A) * r)), y: Math.max(40, Math.min(H - 30, m.y + Math.sin(A) * r * 0.9)) };
  },
};

const scene = {
  reset() {
    this.fx = [];
    this.ship = { from: null, t0: 0, dur: 1, gone: 0, warp: 0, evade: 0 };
    this.ks = new Map();
    this.maru = { gone: 0, fade: 0 };
    this.shieldHit = 0;
  },

  shipPos(now) {
    const s = this.ship;
    const a = g && g.where === 'zone' ? at.near() : at.start();
    let p = a;
    if (s.from) {
      const k = Math.min(1, Math.max(0, (now - s.t0) / s.dur));
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const f = s.from();
      p = { x: f.x + (a.x - f.x) * e, y: f.y + (a.y - f.y) * e };
    }
    if (s.evade && now > s.evade && now < s.evade + 1000) {
      const k = (now - s.evade) / 1000;
      p = { x: p.x + Math.sin(k * Math.PI * 3) * 22 * (1 - k), y: p.y + Math.sin(k * Math.PI * 2) * 14 * (1 - k) };
    }
    if (s.warp && now > s.warp) p = { x: p.x - ((now - s.warp) / 1000) ** 3 * 2400, y: p.y };
    return p;
  },
  kPos(id) { const k = this.ks.get(id); return k ? at.slot(k.slot) : at.maru(); },

  // Turns the events of one turn into timed effects. Returns how long they take, in ms.
  play(events) {
    const now = performance.now();
    const fast = still.matches;
    let t = 120;
    const at0 = ms => now + (fast ? 0 : ms);
    const kfires = events.filter(e => e.type === 'kfire');
    let firedK = false;
    const later = (ms, fn) => setTimeout(fn, fast ? 0 : ms);
    for (const e of events) {
      if (e.type === 'move') {
        this.ship.from = () => at.start(); this.ship.t0 = at0(t); this.ship.dur = fast ? 1 : 1300;
        t += 1300;
      } else if (e.type === 'decloak') {
        const n = [...this.ks.values()].length;
        const k = g.klingons.find(x => x.id === e.target);
        this.ks.set(e.target, { slot: k.slot, appear: at0(t), gone: 0 });
        this.fx.push({ type: 'shimmer', id: e.target, t0: at0(t), dur: 900 });
        if (n === 0) later(t, () => sound.alert());
        t += 220;
      } else if (e.type === 'beam') {
        this.fx.push({ type: 'beam', t0: at0(t), dur: 1300 });
        later(t, () => sound.beam());
        t += 1300;
      } else if (e.type === 'phaser') {
        this.fx.push({ type: 'phaser', id: e.target, t0: at0(t), dur: 600 });
        later(t, () => sound.phaser());
        t += 650;
      } else if (e.type === 'torpedo') {
        this.fx.push({ type: 'torpedo', id: e.target, t0: at0(t), dur: 600 });
        later(t, () => sound.torpedo());
        t += 320;
      } else if (e.type === 'boom') {
        t += 300;
        const k = this.ks.get(e.target);
        if (k) k.gone = at0(t);
        this.fx.push({ type: 'boom', id: e.target, t0: at0(t), dur: 1100, size: 1 });
        later(t, () => sound.boom());
        t += 500;
      } else if (e.type === 'hail') {
        this.fx.push({ type: 'hail', t0: at0(t), dur: 1200 });
        later(t, () => sound.blip(990));
        t += 900;
      } else if (e.type === 'evade') {
        this.ship.evade = at0(t);
        t += 300;
      } else if (e.type === 'kfire') {
        if (!firedK) { t += 200; firedK = true; }
        const i = kfires.indexOf(e);
        this.fx.push({ type: 'disruptor', id: e.from, t0: at0(t + i * 110), dur: 380 });
        if (i === kfires.length - 1) {
          const hitAt = t + i * 110 + 380;
          later(hitAt, () => { sound.thud(); this.shieldHit = performance.now(); });
          t = hitAt + 200;
        }
      } else if (e.type === 'fire-maru') {
        const k = g.klingons.find(x => x.hull > 0);
        this.fx.push({ type: 'disruptor', id: k ? k.id : null, to: 'maru', t0: at0(t), dur: 380 });
        later(t + 380, () => sound.thud());
        t += 600;
      } else if (e.type === 'maru-lost') {
        this.maru.gone = at0(t);
        this.fx.push({ type: 'boom', at: 'maru', t0: at0(t), dur: 1600, size: 1.6 });
        later(t, () => sound.boom(true));
        t += 1200;
      } else if (e.type === 'warp') {
        this.ship.warp = at0(t);
        this.fx.push({ type: 'flash', t0: at0(t + 650), dur: 500 });
        later(t, () => sound.engage(1));
        t += 1300;
        if (g.maru.gone && !this.maru.gone && !g.rewritten) {
          this.maru.gone = at0(t);
          this.fx.push({ type: 'boom', at: 'maru', t0: at0(t), dur: 1600, size: 1.6 });
          later(t, () => sound.boom(true));
          t += 900;
        }
      } else if (e.type === 'abandon') {
        this.fx.push({ type: 'lifeboats', t0: at0(t), dur: 2200 });
        t += 1800;
        this.ship.gone = at0(t);
        this.fx.push({ type: 'boom', at: 'ship', t0: at0(t), dur: 1800, size: 2 });
        later(t, () => sound.boom(true));
        t += 1200;
      } else if (e.type === 'destroyed') {
        this.ship.gone = at0(t);
        this.fx.push({ type: 'boom', at: 'ship', t0: at0(t), dur: 1800, size: 2 });
        later(t, () => sound.boom(true));
        t += 1400;
      }
    }
    if (g.over === 'stayed') { this.maru.fade = at0(t); t += 1500; }
    return fast ? 150 : t;
  },

  draw(now) {
    const c = cx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width / W;
    c.setTransform(s, 0, 0, s, 0, 0);

    // Stars, the range rings and the Neutral Zone.
    c.fillStyle = '#04060b';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) {
      const x = (i * 7919 % 1000), y = (i * 104729 % 997) / 997 * H, b = (i * 31 % 7) / 7;
      c.fillStyle = `rgba(200, 215, 255, ${0.12 + b * 0.35})`;
      c.fillRect(x, y, b > 0.8 ? 2 : 1.2, b > 0.8 ? 2 : 1.2);
    }
    const z = at.zone(), m = at.maru();
    c.save();
    c.beginPath(); c.rect(z, 0, W - z, H); c.clip();
    c.fillStyle = 'rgba(255, 70, 60, 0.05)';
    c.fillRect(z, 0, W - z, H);
    c.strokeStyle = 'rgba(255, 90, 80, 0.07)'; c.lineWidth = 2;
    for (let x = z - H; x < W; x += 26) { c.beginPath(); c.moveTo(x, H); c.lineTo(x + H, 0); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(255, 107, 94, 0.55)'; c.lineWidth = 1.5; c.setLineDash([8, 7]);
    c.beginPath(); c.moveTo(z, 0); c.lineTo(z, H); c.stroke(); c.setLineDash([]);
    c.font = '600 16px "Chakra Petch", sans-serif';
    c.fillStyle = 'rgba(255, 107, 94, 0.75)';
    c.save(); c.translate(z + 8, 64); c.rotate(Math.PI / 2); c.fillText('KLINGON NEUTRAL ZONE', 0, 0); c.restore();
    c.fillStyle = 'rgba(134, 216, 255, 0.45)';
    c.fillText('FEDERATION SPACE', 16, 70);
    c.strokeStyle = 'rgba(134, 216, 255, 0.07)'; c.lineWidth = 1;
    for (const r of [90, 180, 270, 360]) { c.beginPath(); c.arc(m.x, m.y, r, 0, Math.PI * 2); c.stroke(); }

    // The Maru.
    const mg = this.maru;
    let ma = 1;
    if (mg.fade && now > mg.fade) ma = Math.max(0.15, 1 - (now - mg.fade) / 1500);
    if (!mg.gone || now < mg.gone) {
      if (ma > 0.5 && !(g && g.over === 'stayed' && now > mg.fade + 1500)) {
        const k = (now % 1600) / 1600;
        c.strokeStyle = `rgba(134, 216, 255, ${0.5 * (1 - k)})`; c.lineWidth = 2;
        c.beginPath(); c.arc(m.x, m.y, 18 + k * 50, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = ma;
      drawMaru(c, m.x, m.y, g ? g.maru.hull : 100, now);
      c.fillStyle = '#86d8ff'; c.font = '600 17px "Chakra Petch", sans-serif'; c.textAlign = 'center';
      c.fillText('KOBAYASHI MARU', m.x, m.y + 36);
      c.font = '500 15px "IBM Plex Sans", sans-serif'; c.fillStyle = 'rgba(205, 213, 227, 0.8)';
      if (g) c.fillText(g.over === 'stayed' && now > mg.fade + 800 ? 'signal lost' : `${g.maru.aboard} aboard`, m.x, m.y + 55);
      c.textAlign = 'left'; c.globalAlpha = 1;
    } else drawDebris(c, m.x, m.y, now - mg.gone, 7);

    // The Klingons.
    for (const [id, k] of this.ks) {
      if (now < k.appear) continue;
      const p = at.slot(k.slot);
      if (k.gone && now > k.gone) { drawDebris(c, p.x, p.y, now - k.gone, k.slot); continue; }
      const ship = this.shipPos(now);
      const ang = Math.atan2(ship.y - p.y, ship.x - p.x);
      const fade = Math.min(1, (now - k.appear) / 700);
      c.globalAlpha = fade;
      drawKlingon(c, p.x, p.y, ang, fade);
      const hull = g.klingons.find(x => x.id === id)?.hull ?? 0;
      c.fillStyle = 'rgba(255, 255, 255, 0.12)'; c.fillRect(p.x - 18, p.y + 24, 36, 4);
      c.fillStyle = hull > 40 ? '#ff8a5c' : '#ff6b5e'; c.fillRect(p.x - 18, p.y + 24, 36 * (k.gone ? 0 : hull) / 100, 4);
      c.globalAlpha = 1;
    }

    // Your ship and its shields.
    const sp = this.shipPos(now);
    if (!this.ship.gone || now < this.ship.gone) {
      const ang = this.ship.warp && now > this.ship.warp ? Math.PI : Math.atan2(m.y - sp.y, m.x - sp.x);
      if (this.ship.warp && now > this.ship.warp) {
        const k = Math.min(1, (now - this.ship.warp) / 700);
        c.strokeStyle = `rgba(160, 210, 255, ${0.7 * k})`; c.lineWidth = 3;
        c.beginPath(); c.moveTo(sp.x, sp.y); c.lineTo(sp.x + 40 + k * 300, sp.y); c.stroke();
      }
      if (g && g.shields > 0 && !this.beaming(now)) {
        const hitK = Math.max(0, 1 - (now - this.shieldHit) / 500);
        c.strokeStyle = `rgba(134, 216, 255, ${0.12 + g.shields / 100 * 0.25 + hitK * 0.6})`;
        c.lineWidth = 1.5 + hitK * 3;
        c.beginPath(); c.ellipse(sp.x, sp.y, 34, 28, ang, 0, Math.PI * 2); c.stroke();
      }
      drawShip(c, sp.x, sp.y, ang);
    } else drawDebris(c, sp.x, sp.y, now - this.ship.gone, 3);

    // Weapons and the rest.
    this.fx = this.fx.filter(f => now < f.t0 + f.dur + 50);
    for (const f of this.fx) {
      if (now < f.t0) continue;
      const k = (now - f.t0) / f.dur;
      if (k > 1) continue;
      const target = f.id ? this.kPos(f.id) : null;
      if (f.type === 'phaser') {
        c.strokeStyle = `rgba(255, 170, 60, ${1 - k * 0.6})`; c.lineWidth = 3.5;
        c.shadowColor = '#ff9a3c'; c.shadowBlur = 12;
        c.beginPath(); c.moveTo(sp.x, sp.y); c.lineTo(target.x, target.y); c.stroke();
        c.shadowBlur = 0;
      } else if (f.type === 'torpedo') {
        const x = sp.x + (target.x - sp.x) * k, y = sp.y + (target.y - sp.y) * k;
        glow(c, x, y, 7, 'rgba(255, 90, 70, 1)');
      } else if (f.type === 'disruptor') {
        const from = f.id ? this.kPos(f.id) : at.maru();
        const to = f.to === 'maru' ? m : sp;
        const k0 = Math.max(0, k - 0.35);
        c.strokeStyle = 'rgba(120, 255, 140, 0.9)'; c.lineWidth = 3;
        c.shadowColor = '#5dff8a'; c.shadowBlur = 10;
        c.beginPath(); c.moveTo(from.x + (to.x - from.x) * k0, from.y + (to.y - from.y) * k0); c.lineTo(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k); c.stroke();
        c.shadowBlur = 0;
      } else if (f.type === 'shimmer') {
        const p = this.kPos(f.id);
        c.strokeStyle = `rgba(255, 160, 120, ${0.6 * (1 - k)})`; c.lineWidth = 2;
        c.beginPath(); c.ellipse(p.x, p.y, 20 + k * 30, 10 + k * 18, 0, 0, Math.PI * 2); c.stroke();
      } else if (f.type === 'boom') {
        const p = f.at === 'maru' ? m : f.at === 'ship' ? sp : this.kPos(f.id);
        boom(c, p.x, p.y, k, f.size);
      } else if (f.type === 'beam') {
        for (let i = 0; i < 26; i++) {
          const q = ((i / 26) + k * 1.4) % 1;
          const x = m.x + (sp.x - m.x) * q + Math.sin(i * 12.9 + now / 90) * 6;
          const y = m.y + (sp.y - m.y) * q + Math.cos(i * 7.3 + now / 110) * 6;
          c.fillStyle = `rgba(200, 235, 255, ${0.8 * Math.sin(q * Math.PI)})`;
          c.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      } else if (f.type === 'hail') {
        for (let i = 0; i < 3; i++) {
          const q = (k * 1.5 - i * 0.25);
          if (q < 0 || q > 1) continue;
          c.strokeStyle = `rgba(255, 210, 122, ${0.5 * (1 - q)})`; c.lineWidth = 2;
          c.beginPath(); c.arc(sp.x, sp.y, 20 + q * 220, -0.7, 0.7); c.stroke();
        }
      } else if (f.type === 'flash') {
        c.fillStyle = `rgba(200, 225, 255, ${0.5 * (1 - k)})`;
        c.fillRect(0, 0, W, H);
      } else if (f.type === 'lifeboats') {
        for (let i = 0; i < 14; i++) {
          const a = i * 2.39996, d = k * (60 + (i % 4) * 25);
          c.fillStyle = 'rgba(255, 230, 170, 0.9)';
          c.fillRect(sp.x + Math.cos(a) * d - 2, sp.y + Math.sin(a) * d - 2, 4, 4);
        }
      }
    }
  },
  beaming(now) { return this.fx.some(f => f.type === 'beam' && now >= f.t0 && now < f.t0 + f.dur); },
};
scene.reset();

function glow(c, x, y, r, col) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r * 2.5);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, col); gr.addColorStop(1, 'rgba(255, 60, 40, 0)');
  c.fillStyle = gr; c.beginPath(); c.arc(x, y, r * 2.5, 0, Math.PI * 2); c.fill();
}

function boom(c, x, y, k, size = 1) {
  const r = (12 + k * 46) * size;
  const gr = c.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255, 255, 230, ${1 - k})`);
  gr.addColorStop(0.35, `rgba(255, 170, 60, ${0.85 * (1 - k)})`);
  gr.addColorStop(1, 'rgba(255, 60, 30, 0)');
  c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = `rgba(255, 200, 140, ${0.5 * (1 - k)})`; c.lineWidth = 2;
  c.beginPath(); c.arc(x, y, r * 1.3, 0, Math.PI * 2); c.stroke();
}

function drawDebris(c, x, y, age, seed) {
  const k = Math.min(1, age / 4000);
  c.fillStyle = `rgba(160, 150, 140, ${0.7 - k * 0.4})`;
  for (let i = 0; i < 12; i++) {
    const a = (i * 2.4 + seed) % (Math.PI * 2), d = 6 + (i * 13 + seed * 7) % 22 + k * 10;
    c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.5, 2.5);
  }
}

// Seen from above. The ship points along +x before turning.
function drawShip(c, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = '#ffd08a'; c.strokeStyle = '#1d1204'; c.lineWidth = 1;
  c.fillRect(-20, -9.5, 16, 3.2); c.fillRect(-20, 6.3, 16, 3.2); // nacelles
  c.fillStyle = '#e8b06a';
  c.fillRect(-12, -7, 2, 14); // pylons
  c.beginPath(); c.ellipse(-8, 0, 9, 3.6, 0, 0, Math.PI * 2); c.fill(); // engineering hull
  c.fillRect(-2, -1.5, 6, 3); // neck
  c.fillStyle = '#ffb54a';
  c.beginPath(); c.arc(9, 0, 9, 0, Math.PI * 2); c.fill(); c.stroke(); // saucer
  c.fillStyle = '#fff3d6'; c.beginPath(); c.arc(9, 0, 2.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255, 120, 80, 0.9)'; c.fillRect(-20, -9.5, 3, 3.2); c.fillRect(-20, 6.3, 3, 3.2);
  c.restore();
}

function drawKlingon(c, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = '#ff8a5c'; c.strokeStyle = '#3a120a'; c.lineWidth = 1;
  c.beginPath(); // wings
  c.moveTo(-2, 0); c.lineTo(-8, -15); c.lineTo(-14, -16); c.lineTo(-11, -4); c.lineTo(-16, 0); c.lineTo(-11, 4); c.lineTo(-14, 16); c.lineTo(-8, 15); c.closePath();
  c.fill(); c.stroke();
  c.fillRect(-2, -1.3, 13, 2.6); // boom
  c.beginPath(); c.ellipse(13, 0, 4.5, 3.5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); // command pod
  c.fillStyle = 'rgba(120, 255, 140, 0.8)'; c.fillRect(-16, -1, 2, 2);
  c.restore();
}

function drawMaru(c, x, y, hull, now) {
  c.save(); c.translate(x, y); c.rotate(-0.25);
  c.fillStyle = '#5d7488'; c.fillRect(-26, -5, 52, 10);
  c.fillStyle = '#86a4bd';
  for (let i = 0; i < 4; i++) c.fillRect(-22 + i * 11, -9, 9, 18);
  c.fillStyle = '#b8cde0'; c.fillRect(20, -4, 9, 8);
  if (hull < 100) {
    const flick = 0.5 + 0.5 * Math.sin(now / 70);
    c.fillStyle = `rgba(255, 150, 60, ${0.5 + 0.4 * flick})`;
    c.beginPath(); c.arc(-6, 3, 3 + (100 - hull) / 20, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

let looping = false;
function loop() {
  if (looping) return;
  looping = true;
  const frame = now => {
    if ($('sim').hidden || document.hidden) { looping = false; return; }
    scene.draw(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('sim').hidden) loop(); });

// ---------- Wiring ----------

$('start').addEventListener('click', () => start(false));
$('rewrite').addEventListener('click', () => start(true));
$('again').addEventListener('click', showBrief);
$('orders').addEventListener('click', e => {
  const b = e.target.closest('.order');
  if (b && !b.disabled) give(b.dataset.id);
});

showBrief();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.maru = { get game() { return g; }, start, give, get busy() { return busy; }, evaluate: () => evaluate(g), CREW, MARU };
