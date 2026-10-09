// Engine sounds, made on the spot with Web Audio: no sound files to download.
let ctx = null, master = null, hum = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function noise(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

export const sound = {
  on: true,

  blip(freq = 880) {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.16);
  },

  // The jump: a rising rush of filtered noise over a low swell, which settles into a hum for the trip.
  engage(seconds) {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime;
    const n = noise(seconds + 3), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(180, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 1.6);
    bp.frequency.exponentialRampToValueAtTime(520, t + 2.6);
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.5, t + 1.5);
    ng.gain.exponentialRampToValueAtTime(0.09, t + 2.6);
    ng.gain.setValueAtTime(0.09, t + seconds);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 1.4);
    n.connect(bp).connect(ng).connect(master);
    n.start(t);
    n.stop(t + seconds + 1.5);

    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sawtooth';
    o2.type = 'sine';
    o.frequency.setValueAtTime(42, t);
    o.frequency.exponentialRampToValueAtTime(66, t + 1.5);
    o2.frequency.setValueAtTime(84, t);
    o2.frequency.exponentialRampToValueAtTime(132, t + 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.22, t + 1.4);
    og.gain.exponentialRampToValueAtTime(0.1, t + 2.4);
    og.gain.setValueAtTime(0.1, t + seconds);
    og.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 1.2);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(og).connect(master);
    for (const x of [o, o2]) { x.start(t); x.stop(t + seconds + 1.3); }
    hum = { o, o2, og };
  },

  // Dropping out of warp: a falling whoosh.
  arrive() {
    if (!this.on || !ensure()) return;
    const t = ctx.currentTime;
    const n = noise(1.6), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(2200, t);
    bp.frequency.exponentialRampToValueAtTime(140, t + 1.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    n.connect(bp).connect(g).connect(master);
    n.start(t);
    n.stop(t + 1.5);
    hum = null;
  },

  // For the Kobayashi Maru: weapons, hits and the red alert.
  phaser() {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    o2.frequency.setValueAtTime(1407, t); o2.frequency.exponentialRampToValueAtTime(690, t + 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
    g.gain.setValueAtTime(0.06, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(master);
    for (const x of [o, o2]) { x.start(t); x.stop(t + 0.62); }
  },

  torpedo() {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.42);
  },

  boom(big = false) {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime, len = big ? 2.4 : 1.1;
    const n = noise(len), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(big ? 1800 : 1200, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(big ? 0.9 : 0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(lp).connect(g).connect(master);
    n.start(t); n.stop(t + len + 0.05);
  },

  // A short hit on the hull: a thud with some rattle.
  thud() {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.4);
  },

  // Red alert: two rising whoops.
  alert() {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t0 = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.55, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
      g.gain.setValueAtTime(0.07, t + 0.38);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
      o.connect(lp).connect(g).connect(master);
      o.start(t); o.stop(t + 0.5);
    }
  },

  // The transporter: a shimmer of high tones.
  beam() {
    if (!this.on || !ensure()) return;
    ctx.resume();
    const t = ctx.currentTime;
    for (const [f, d] of [[1760, 0], [2217, 0.05], [2637, 0.1], [3520, 0.15]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t + d);
      o.frequency.linearRampToValueAtTime(f * 1.02, t + d + 1.1);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.025, t + d + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.2);
      o.connect(g).connect(master);
      o.start(t + d); o.stop(t + d + 1.25);
    }
  },

  stop() {
    if (hum && ctx) {
      const t = ctx.currentTime;
      hum.og.gain.cancelScheduledValues(t);
      hum.og.gain.setValueAtTime(0.0001, t);
      hum = null;
    }
    if (ctx) master.gain.setValueAtTime(this.on ? 0.5 : 0, ctx.currentTime);
  },
};
