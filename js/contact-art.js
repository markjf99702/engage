// First contact: the viewscreen. Draws their captain on their own bridge, made up from the language's seed so each
// species looks different, and the picture they send of the danger. 2D canvas, sized in CSS pixels by the caller.
import { rng } from './contact-sim.js';

// The look of one species, fixed by its seed.
export function species(seed) {
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  return {
    hue,
    skin: [hue, 18 + r() * 30, 38 + r() * 18],
    glow: (hue + 120 + Math.floor(r() * 120)) % 360,
    cloth: (hue + 160 + Math.floor(r() * 80)) % 360,
    head: Math.floor(r() * 4), // dome, crest, fins, long
    eyes: Math.floor(r() * 3), // two, three, a band
    marks: Math.floor(r() * 3), // ridges, spots, stripes
    wide: 0.9 + r() * 0.25,
  };
}

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// state: { speaking 0–1, mood: 'calm' | 'wary' | 'glad', pic: danger id or null, closed: bool }
export function drawScreen(c, W, H, look, state, now) {
  const s = look;
  c.save();
  // Their bridge: dark, tinted, with ribs and a row of lights.
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, hsl(s.cloth, 30, 9));
  bg.addColorStop(1, hsl(s.cloth, 25, 4));
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = hsl(s.cloth, 35, 18, 0.7); c.lineWidth = Math.max(2, H * 0.012);
  for (let i = -3; i <= 3; i++) {
    const x = W / 2 + i * W * 0.17;
    c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + i * W * 0.04, H * 0.3, W / 2 + i * W * 0.08, -10); c.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = W * (0.04 + i * 0.07), on = Math.sin(now / 700 + i * 1.7) > 0.2;
    c.fillStyle = hsl((s.glow + i * 25) % 360, 80, on ? 65 : 30, on ? 0.9 : 0.5);
    c.fillRect(x, H * 0.9, W * 0.03, H * 0.012);
  }
  if (state.closed) { closed(c, W, H, now); c.restore(); return; }

  const pic = state.pic;
  const cx = pic ? W * 0.34 : W * 0.5;
  const u = Math.min(H * 0.95, W * 0.72); // the size of a person
  const by = Math.sin(now / 1500) * u * 0.006;
  const top = H * 0.07 + by;

  // Shoulders and collar.
  const sh = u * 0.5;
  const cloth = c.createLinearGradient(cx - sh, 0, cx + sh, 0);
  cloth.addColorStop(0, hsl(s.cloth, 40, 14)); cloth.addColorStop(0.45, hsl(s.cloth, 45, 30)); cloth.addColorStop(1, hsl(s.cloth, 40, 12));
  c.fillStyle = cloth;
  c.beginPath();
  c.moveTo(cx - sh, H + 2);
  c.bezierCurveTo(cx - sh, top + u * 0.74, cx - u * 0.24, top + u * 0.66, cx - u * 0.1, top + u * 0.64);
  c.lineTo(cx + u * 0.1, top + u * 0.64);
  c.bezierCurveTo(cx + u * 0.24, top + u * 0.66, cx + sh, top + u * 0.74, cx + sh, H + 2);
  c.fill();
  // Neck.
  const [h, sat, lig] = s.skin;
  const neck = c.createLinearGradient(cx - u * 0.09, 0, cx + u * 0.09, 0);
  neck.addColorStop(0, hsl(h, sat, lig - 22)); neck.addColorStop(0.4, hsl(h, sat, lig - 8)); neck.addColorStop(1, hsl(h, sat, lig - 24));
  c.fillStyle = neck;
  c.beginPath(); c.moveTo(cx - u * 0.08, top + u * 0.46); c.lineTo(cx - u * 0.1, top + u * 0.68); c.lineTo(cx + u * 0.1, top + u * 0.68); c.lineTo(cx + u * 0.08, top + u * 0.46); c.fill();
  // A high collar, and a light at its throat that pulses while they speak.
  c.fillStyle = hsl(s.cloth, 40, 20);
  c.beginPath(); c.moveTo(cx - u * 0.15, top + u * 0.6); c.quadraticCurveTo(cx, top + u * 0.76, cx + u * 0.15, top + u * 0.6); c.lineTo(cx + u * 0.19, top + u * 0.7); c.quadraticCurveTo(cx, top + u * 0.86, cx - u * 0.19, top + u * 0.7); c.fill();
  c.strokeStyle = hsl(s.cloth, 55, 50, 0.8); c.lineWidth = u * 0.006;
  c.beginPath(); c.moveTo(cx - u * 0.19, top + u * 0.7); c.quadraticCurveTo(cx, top + u * 0.86, cx + u * 0.19, top + u * 0.7); c.stroke();
  c.fillStyle = hsl(s.glow, 90, 62, 0.35 + 0.65 * state.speaking * (0.6 + 0.4 * Math.sin(now / 90)));
  c.shadowColor = hsl(s.glow, 90, 60); c.shadowBlur = u * 0.04 * state.speaking;
  c.beginPath(); c.ellipse(cx, top + u * 0.75, u * 0.03, u * 0.016, 0, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0;

  // The head: a wide skull narrowing to the chin.
  const hx = cx, hy = top + u * 0.3, rx = u * 0.15 * s.wide, ry = u * 0.2;
  const skin = c.createRadialGradient(hx - rx * 0.35, hy - ry * 0.35, rx * 0.1, hx, hy, ry * 1.35);
  skin.addColorStop(0, hsl(h, sat, lig + 16)); skin.addColorStop(0.55, hsl(h, sat, lig)); skin.addColorStop(1, hsl(h, sat, lig - 20));
  c.fillStyle = skin;
  if (s.head === 2) { // fins at the temples
    for (const k of [-1, 1]) {
      c.beginPath(); c.moveTo(hx + k * rx * 0.8, hy - ry * 0.05); c.quadraticCurveTo(hx + k * rx * 1.5, hy - ry * 0.5, hx + k * rx * 1.7, hy - ry * 1.05); c.lineTo(hx + k * rx * 0.7, hy - ry * 0.6); c.fill();
    }
  }
  if (s.head === 3) { c.beginPath(); c.ellipse(hx + rx * 0.3, hy - ry * 0.6, rx * 0.85, ry * 0.75, 0.45, 0, Math.PI * 2); c.fill(); } // a long skull
  const crown = s.head === 0 ? 1.25 : 1;
  c.beginPath();
  c.moveTo(hx, hy - ry * crown);
  for (const k of [1, -1]) {
    if (k === -1) c.moveTo(hx, hy - ry * crown);
    c.bezierCurveTo(hx + k * rx * 1.05, hy - ry * crown, hx + k * rx * 1.12, hy + ry * 0.05, hx + k * rx * 0.86, hy + ry * 0.48);
    c.bezierCurveTo(hx + k * rx * 0.62, hy + ry * 0.92, hx + k * rx * 0.3, hy + ry * 1.06, hx, hy + ry * 1.06);
  }
  c.fill();
  if (s.head === 1) { // a crest down the middle
    c.fillStyle = hsl(h, sat + 10, lig - 14);
    c.beginPath(); c.moveTo(hx - rx * 0.13, hy - ry * 0.4); c.quadraticCurveTo(hx, hy - ry * 1.55, hx + rx * 0.13, hy - ry * 0.4); c.fill();
  }
  // Light from their bridge along one cheek, and the brow's shadow.
  const rim = c.createLinearGradient(hx + rx * 0.5, 0, hx + rx * 1.1, 0);
  rim.addColorStop(0, hsl(s.glow, 70, 60, 0)); rim.addColorStop(1, hsl(s.glow, 70, 60, 0.35));
  c.fillStyle = rim; c.fill();
  c.fillStyle = hsl(h, sat, lig - 26, 0.55);
  c.beginPath(); c.ellipse(hx, hy - ry * 0.12, rx * 0.8, ry * 0.12, 0, Math.PI, 0); c.fill();
  c.strokeStyle = hsl(h, sat, lig - 22, 0.7); c.lineWidth = u * 0.006;
  c.beginPath(); c.moveTo(hx, hy + ry * 0.12); c.lineTo(hx - rx * 0.05, hy + ry * 0.33); c.lineTo(hx + rx * 0.06, hy + ry * 0.35); c.stroke(); // nose

  // Markings.
  c.strokeStyle = hsl(h, sat, lig - 20, 0.8); c.fillStyle = hsl(h, sat, lig - 22, 0.8); c.lineWidth = u * 0.007;
  if (s.marks === 0) for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(hx, hy - ry * 0.2 + i * u * 0.004, rx * (0.35 + i * 0.12), Math.PI * 1.25, Math.PI * 1.75); c.stroke(); }
  if (s.marks === 1) for (const k of [-1, 1]) for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(hx + k * rx * (0.82 - i * 0.03), hy - ry * 0.35 + i * ry * 0.18, u * 0.007, 0, Math.PI * 2); c.fill(); }
  if (s.marks === 2) for (const k of [-1, 1]) { c.beginPath(); c.moveTo(hx + k * rx * 0.35, hy + ry * 0.05); c.lineTo(hx + k * rx * 0.6, hy + ry * 0.5); c.stroke(); }

  // Eyes, which blink now and then.
  const blink = Math.max(0.08, Math.min(1, Math.abs(((now / 4200) % 1) - 0.02) * 40));
  const ey = hy - ry * 0.02, mood = state.mood;
  const iris = mood === 'wary' ? hsl(5, 90, 62) : hsl(s.glow, 85, mood === 'glad' ? 72 : 62);
  const eye = (x, y, w, hgt) => {
    c.fillStyle = 'rgba(5, 5, 10, 0.9)';
    c.beginPath(); c.ellipse(x, y, w, hgt * blink, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = iris; c.shadowColor = iris; c.shadowBlur = u * 0.03;
    c.beginPath(); c.ellipse(x, y, w * 0.45, hgt * 0.7 * blink, 0, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
  };
  if (s.eyes === 2) {
    c.fillStyle = 'rgba(5, 5, 10, 0.9)'; c.beginPath(); c.ellipse(hx, ey, rx * 0.78, u * 0.028, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = iris; c.shadowColor = iris; c.shadowBlur = u * 0.04;
    c.fillRect(hx - rx * 0.62, ey - u * 0.006 * blink, rx * 1.24, u * 0.012 * blink);
    c.shadowBlur = 0;
  } else {
    eye(hx - rx * 0.42, ey, rx * 0.24, u * 0.028);
    eye(hx + rx * 0.42, ey, rx * 0.24, u * 0.028);
    if (s.eyes === 1) eye(hx, ey - ry * 0.42, rx * 0.13, u * 0.02);
  }

  // The mouth, which moves while they speak.
  const open = state.speaking * (0.5 + 0.5 * Math.abs(Math.sin(now / 110) * Math.sin(now / 47)));
  c.fillStyle = hsl(h, sat, lig - 28);
  c.beginPath(); c.ellipse(hx, hy + ry * 0.62, rx * (mood === 'glad' ? 0.34 : 0.28), u * (0.005 + 0.02 * open), 0, 0, Math.PI * 2); c.fill();

  // When they're alarmed, the bridge lights go red.
  if (mood === 'wary') { c.fillStyle = `rgba(255, 40, 30, ${0.1 + 0.05 * Math.sin(now / 300)})`; c.fillRect(0, 0, W, H); }

  if (pic) picture(c, W, H, pic, now);

  // Scan lines and a vignette, so it reads as a screen.
  c.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.restore();
}

// The picture they send of what's coming.
function picture(c, W, H, kind, now) {
  const w = W * 0.34, h = w * 0.72, x = W - w - W * 0.04, y = H * 0.16;
  c.save();
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.clip();
  c.fillStyle = '#03050a'; c.fillRect(x, y, w, h);
  const r = rng(7);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; c.fillRect(x + r() * w, y + r() * h, 1, 1); }
  if (kind === 'storm') {
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(60, 120, 255, 0)'); g.addColorStop(0.6, 'rgba(60, 120, 255, 0.35)'); g.addColorStop(1, 'rgba(120, 180, 255, 0.6)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = '#bfe0ff'; c.lineWidth = 1.5; c.shadowColor = '#7fb8ff'; c.shadowBlur = 8;
    const t = Math.floor(now / 160);
    for (let k = 0; k < 3; k++) {
      const q = rng(t * 3 + k);
      let px = x + w * (0.55 + q() * 0.4), py = y;
      c.beginPath(); c.moveTo(px, py);
      while (py < y + h) { px += (q() - 0.5) * w * 0.12; py += h * 0.1; c.lineTo(px, py); }
      c.stroke();
    }
  } else if (kind === 'creature') {
    const cx = x + w * 0.6, cy = y + h * 0.42, pulse = 1 + Math.sin(now / 600) * 0.04;
    c.strokeStyle = 'rgba(220, 230, 255, 0.35)'; c.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const sx = cx - w * 0.22 + i * w * 0.055;
      c.beginPath(); c.moveTo(sx, cy + h * 0.1);
      c.bezierCurveTo(sx + Math.sin(now / 500 + i) * 8, cy + h * 0.3, sx - Math.sin(now / 400 + i) * 8, cy + h * 0.45, sx + 3, y + h);
      c.stroke();
    }
    const g = c.createRadialGradient(cx, cy - h * 0.05, 2, cx, cy, w * 0.26 * pulse);
    g.addColorStop(0, 'rgba(255, 240, 250, 0.9)'); g.addColorStop(0.6, 'rgba(200, 190, 255, 0.45)'); g.addColorStop(1, 'rgba(160, 150, 255, 0.05)');
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, w * 0.26 * pulse, h * 0.2 * pulse, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#556'; c.fillRect(x + w * 0.15, y + h * 0.7, 10, 3); c.fillRect(x + w * 0.25, y + h * 0.8, 6, 3);
  } else {
    const q = rng(11);
    for (let i = 0; i < 46; i++) {
      const mx = x + q() * w, my = y + q() * h, mr = 2 + q() * 4;
      c.fillStyle = '#2a2f3a'; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
      if (Math.sin(now / 300 + i * 2.3) > 0.3) { c.fillStyle = '#ff4a3a'; c.fillRect(mx - 1, my - 1, 2, 2); }
    }
  }
  c.restore();
  c.strokeStyle = 'rgba(201, 162, 255, 0.6)'; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.stroke();
  c.fillStyle = 'rgba(201, 162, 255, 0.85)';
  c.font = `600 ${Math.max(9, Math.round(w * 0.055))}px "Chakra Petch", sans-serif`;
  c.fillText('TRANSMITTED IMAGE', x + 2, y + h + Math.max(12, w * 0.07));
}

// Static, after the channel closes.
function closed(c, W, H, now) {
  const q = rng(Math.floor(now / 80));
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(200, 200, 220, ${q() * 0.25})`; c.fillRect(q() * W, q() * H, 2, 2); }
  c.fillStyle = 'rgba(201, 162, 255, 0.8)';
  c.font = `600 ${Math.round(H * 0.06)}px "Chakra Petch", sans-serif`;
  c.textAlign = 'center';
  c.fillText('CHANNEL CLOSED', W / 2, H / 2);
}
