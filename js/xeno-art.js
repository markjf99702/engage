// Draws a creature from js/xeno-gen.js in its home: the sky or sea around it, the ground, and the animal itself, side on.
// Everything is shapes on a 2D canvas, worked out from the creature's numbers, so the same creature always looks the same.
import { rng, STARS, sizeText } from './xeno-gen.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const hsl = (c, dl = 0, a = 1, ds = 0) => `hsla(${c.h},${clamp(c.s + ds, 0, 100)}%,${clamp(c.l + dl, 0, 100)}%,${a})`;
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const ease = t => 1 - Math.pow(1 - clamp(t), 3);

// The ground for each kind of world.
const GROUND = {
  M: '#36502a', L: '#2f5426', K: '#7c4128', H: '#b88d55', O: '#b9a372', P: '#cfdbe8', D: '#5d5e66', Y: '#24150f',
  'super-earth': '#4a4934', 'lava-world': '#141012',
};
const CLOUDS = {
  N: ['#e9d9a6', '#d6bf80', '#f3e7c2'], J: ['#e6cfa6', '#c9935f', '#f4e8d0', '#a8673f'], T: ['#d9a7a0', '#9c5a52', '#efd2c5'],
  'hot-jupiter': ['#5a1d18', '#8c2f1d', '#3a1210', '#c4532a'],
};

// The whole picture. `time` is in seconds and drives the idle motion; `grown` runs 0 → 1 as the creature appears.
export function drawScene(g, c, W, H, time = 0, grown = 1) {
  g.save();
  g.clearRect(0, 0, W, H);
  const groundY = c.env.habitat === 'burrow' ? H * 0.3 : H * 0.8;
  backdrop(g, c, W, H, groundY, time);

  const b = c.body;
  const s = Math.min(W * 0.62, H * 0.62); // the creature's main length in pixels
  let x = W * 0.54, y;
  if (b.plan === 'walker' || b.plan === 'flyer' || b.plan === 'plant') y = groundY;
  else if (b.plan === 'crawler') y = groundY;
  else if (b.plan === 'burrower') y = H * 0.6;
  else y = H * 0.5;
  if (b.plan === 'flyer') y = groundY - H * 0.18;

  const k = ease(grown);
  g.save();
  g.globalAlpha = clamp(grown * 1.6);
  g.translate(x, y);
  g.scale(0.35 + 0.65 * k, 0.35 + 0.65 * k);
  const draw = { walker, flyer: walker, swimmer, floater, burrower, plant, crawler }[b.plan];
  const extent = draw(g, b, s, time, c);
  g.restore();

  if (grown >= 1) scale(g, c, W, H, x, groundY, s, extent);
  if (grown < 1) scan(g, W, H, grown);
  g.restore();
}

// ---------- Surroundings ----------

function backdrop(g, c, W, H, groundY, time) {
  const { env } = c;
  const r = rng(c.seed * 31 + 7);
  const star = STARS[env.star].color;
  const h = env.habitat;

  if (h === 'sea' || h === 'under-ice') {
    const deep = env.dark;
    const top = deep ? '#06121c' : env.star === 'red' ? '#3b2a3c' : env.star === 'orange' ? '#1d5160' : '#1f6f8f';
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, deep ? '#010307' : '#06202c');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    if (!deep) { // light from above
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x0 = W * (0.1 + 0.2 * i) + Math.sin(time * 0.3 + i) * 12;
        const ray = g.createLinearGradient(0, 0, 0, H * 0.8);
        ray.addColorStop(0, rgba(star, 0.09)); ray.addColorStop(1, rgba(star, 0));
        g.fillStyle = ray;
        g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 30, 0); g.lineTo(x0 + 90, H * 0.8); g.lineTo(x0 + 20, H * 0.8); g.fill();
      }
      g.restore();
    }
    if (h === 'under-ice') { // ice overhead, a vent below
      g.fillStyle = '#9fc2d8';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0);
      for (let x = W; x >= 0; x -= W / 12) g.lineTo(x, H * (0.07 + 0.04 * r()));
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, W, H * 0.04);
    }
    // sea floor
    g.fillStyle = deep ? '#0c0f14' : '#1d2a26';
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 16) g.lineTo(x, H * (0.9 + 0.04 * Math.sin(x * 0.02 + c.seed)));
    g.lineTo(W, H); g.fill();
    if (h === 'under-ice' || env.dark) vent(g, W * 0.15, H * 0.92, H, time);
    // drifting specks
    g.fillStyle = deep ? 'rgba(170,220,255,0.35)' : 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) {
      const px = (r() * W + time * 6 * (0.5 + r())) % W, py = (r() * H - time * 4 * r() + H) % H;
      g.beginPath(); g.arc(px, py, 0.6 + r() * 1.2, 0, TAU); g.fill();
    }
    return;
  }

  if (h === 'cloud') {
    const cols = CLOUDS[c.classId] || CLOUDS.J;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, shade(cols[0], -0.25)); grad.addColorStop(0.5, cols[0]); grad.addColorStop(1, shade(cols[1], -0.35));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { // bands of cloud
      const yb = H * (i / 9 + r() * 0.05), hb = H * (0.04 + r() * 0.08);
      g.fillStyle = hex2rgba(cols[i % cols.length], 0.35);
      g.beginPath(); g.moveTo(0, yb);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, yb + Math.sin(x * 0.012 + i + time * 0.1) * hb * 0.4);
      for (let x = W; x >= 0; x -= 20) g.lineTo(x, yb + hb + Math.sin(x * 0.015 + i * 2 + time * 0.08) * hb * 0.4);
      g.fill();
    }
    if (c.classId === 'hot-jupiter') { g.fillStyle = 'rgba(255,90,30,0.12)'; g.fillRect(0, H * 0.6, W, H * 0.4); }
    return;
  }

  // Sky
  const thin = env.pressure < 0.1;
  const tint = env.star === 'red' ? ['#2a0f1a', '#7a3b3a'] : env.star === 'orange' ? ['#3a2a3c', '#d99a6c'] : ['#1d4f8f', '#9cc7e8'];
  const grad = g.createLinearGradient(0, 0, 0, groundY);
  if (thin) { grad.addColorStop(0, '#020308'); grad.addColorStop(1, c.classId === 'K' ? '#5b3a30' : '#151821'); }
  else if (c.classId === 'Y') { grad.addColorStop(0, '#1a0d0b'); grad.addColorStop(1, '#6e3418'); }
  else { grad.addColorStop(0, tint[0]); grad.addColorStop(1, tint[1]); }
  g.fillStyle = grad; g.fillRect(0, 0, W, groundY);
  if (thin) { // stars show through thin air
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 70; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.fillRect(r() * W, r() * groundY * 0.8, 1.2, 1.2); }
    g.globalAlpha = 1;
  }
  if (star) { // the sun
    const sx = W * 0.3, sy = H * 0.14, sr = env.star === 'red' ? H * 0.07 : env.star === 'orange' ? H * 0.05 : H * 0.04;
    const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * (thin ? 2.2 : 5));
    glow.addColorStop(0, rgba(star, 0.55)); glow.addColorStop(1, rgba(star, 0));
    g.fillStyle = glow; g.fillRect(0, 0, W, groundY);
    g.fillStyle = rgba(star); g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
  }
  if (env.pressure > 2.5 || c.classId === 'Y') { // haze
    const hz = g.createLinearGradient(0, groundY * 0.4, 0, groundY);
    hz.addColorStop(0, 'rgba(255,220,180,0)'); hz.addColorStop(1, c.classId === 'Y' ? 'rgba(255,120,40,0.35)' : 'rgba(255,235,210,0.25)');
    g.fillStyle = hz; g.fillRect(0, 0, W, groundY);
  }

  // Distant hills, then the ground
  const ground = groundColor(c);
  g.fillStyle = shade(ground, -0.2);
  g.beginPath(); g.moveTo(0, groundY);
  for (let x = 0; x <= W; x += W / 10) g.lineTo(x, groundY - H * (0.04 + 0.06 * r()));
  g.lineTo(W, groundY); g.fill();
  const gg = g.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0, ground); gg.addColorStop(1, shade(ground, -0.45));
  g.fillStyle = gg; g.fillRect(0, groundY, W, H - groundY);

  if (h === 'burrow') { // cut away the ground to show the tunnel
    g.fillStyle = shade(ground, -0.3);
    g.fillRect(0, groundY, W, H - groundY);
    for (let i = 0; i < 4; i++) { g.fillStyle = shade(ground, -0.3 - i * 0.08); g.fillRect(0, groundY + (H - groundY) * (0.1 + i * 0.25), W, 3); }
    g.fillStyle = shade(ground, -0.1); g.fillRect(0, groundY - 2, W, 6);
  }
  if (c.classId === 'Y' || c.classId === 'lava-world') { // glowing cracks
    g.strokeStyle = c.classId === 'Y' ? 'rgba(255,120,40,0.7)' : 'rgba(255,90,20,0.85)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      let x = r() * W, y = groundY + r() * (H - groundY);
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 12; g.lineTo(x, y); }
      g.stroke();
    }
  }
  // Tufts of plants where things grow
  if (['M', 'L', 'O', 'super-earth'].includes(c.classId) && h !== 'burrow') {
    const leaf = env.star === 'red' ? '#120c14' : env.star === 'orange' ? '#8a3f22' : '#2f6a28';
    g.strokeStyle = leaf; g.lineWidth = 1.4;
    for (let i = 0; i < 40; i++) {
      const x = r() * W, y = groundY + 2 + r() * (H - groundY) * 0.9, hh = 4 + r() * 8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - hh * 0.6, x + 3 + Math.sin(time + i) * 1.5, y - hh); g.stroke();
    }
  }
}

function groundColor(c) {
  if (c.classId === 'L' && c.env.star === 'red') return '#1d1820';
  if (c.classId === 'M' && c.env.star === 'red') return '#2a2229';
  if (c.classId === 'M' && c.env.star === 'orange') return '#5a3a24';
  return GROUND[c.classId] || '#555';
}

function vent(g, x, y, H, time) {
  g.fillStyle = '#1b1d22';
  g.beginPath(); g.moveTo(x - 26, y + 20); g.lineTo(x - 8, y - H * 0.12); g.lineTo(x + 8, y - H * 0.12); g.lineTo(x + 26, y + 20); g.fill();
  const glow = g.createRadialGradient(x, y - H * 0.12, 2, x, y - H * 0.12, 60);
  glow.addColorStop(0, 'rgba(255,140,60,0.55)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = glow; g.fillRect(x - 60, y - H * 0.12 - 60, 120, 120);
  g.fillStyle = 'rgba(120,120,130,0.25)';
  for (let i = 0; i < 6; i++) {
    const t = (time * 0.25 + i / 6) % 1;
    g.beginPath(); g.arc(x + Math.sin(t * 6 + i) * 8 * t, y - H * 0.12 - t * H * 0.3, 6 + t * 18, 0, TAU); g.fill();
  }
}

// The size bar, and a person for scale when one would fit.
function scale(g, c, W, H, x, groundY, s, extent) {
  const size = c.body.size;
  const pxPerM = extent / size;
  const steps = [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000, 5000];
  let unit = steps[0];
  for (const u of steps) if (u * pxPerM <= Math.min(140, W * 0.3)) unit = u;
  const len = unit * pxPerM;
  const bx = 16, by = H - 18;
  g.strokeStyle = 'rgba(232,237,246,0.85)'; g.fillStyle = 'rgba(232,237,246,0.9)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(bx, by - 5); g.lineTo(bx, by); g.lineTo(bx + len, by); g.lineTo(bx + len, by - 5); g.stroke();
  g.font = '600 12px "Chakra Petch", "Arial Narrow", sans-serif';
  g.textBaseline = 'bottom';
  g.fillText(sizeText(unit), bx + len + 6, by + 3);

  const plan = c.body.plan;
  const person = 1.75 * pxPerM;
  if ((plan === 'walker' || plan === 'plant' || plan === 'crawler') && person > 14 && person < H * 0.72) {
    const px = x - s * 0.62 - person * 0.18;
    if (px < 10) return;
    human(g, px, groundY, person);
  }
}

function human(g, x, y, h) {
  g.save();
  g.fillStyle = 'rgba(12,16,26,0.72)'; g.strokeStyle = 'rgba(232,237,246,0.55)'; g.lineWidth = 1;
  const u = h / 8;
  g.beginPath();
  g.arc(x, y - h + u * 0.55, u * 0.55, 0, TAU);
  g.moveTo(x - u * 0.9, y - h + u * 1.3);
  g.lineTo(x + u * 0.9, y - h + u * 1.3);
  g.lineTo(x + u * 1.05, y - h + u * 4.1); g.lineTo(x + u * 0.6, y - h + u * 4.1);
  g.lineTo(x + u * 0.55, y); g.lineTo(x + u * 0.1, y); g.lineTo(x, y - h + u * 4.6);
  g.lineTo(x - u * 0.1, y); g.lineTo(x - u * 0.55, y); g.lineTo(x - u * 0.6, y - h + u * 4.1);
  g.lineTo(x - u * 1.05, y - h + u * 4.1); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

function scan(g, W, H, t) {
  const y = H * ((t * 1.4) % 1);
  const grad = g.createLinearGradient(0, y - 40, 0, y + 4);
  grad.addColorStop(0, 'rgba(134,216,255,0)'); grad.addColorStop(1, 'rgba(134,216,255,0.35)');
  g.fillStyle = grad; g.fillRect(0, y - 40, W, 44);
  g.fillStyle = 'rgba(134,216,255,0.8)'; g.fillRect(0, y, W, 1.5);
}

// ---------- Creatures ----------
// Each draws around (0, 0): feet on the ground for walkers and plants, the middle of the body for the rest.
// Each returns how many pixels its measured size takes (height, length or width), for the scale bar.

function outline(g, b, s) { g.strokeStyle = hsl(b.color, -22, 0.9); g.lineWidth = Math.max(1, s * 0.01); g.lineJoin = 'round'; g.lineCap = 'round'; }

function bodyFill(g, b, x, y, w, h) {
  const grad = g.createLinearGradient(0, y - h, 0, y + h);
  grad.addColorStop(0, hsl(b.color, 8));
  grad.addColorStop(0.6, hsl(b.color, 0));
  grad.addColorStop(1, hsl(b.color, 18, 1, -10)); // a paler belly
  return grad;
}

function eye(g, b, x, y, r, s) {
  const red = b.eyeSize > 1.5;
  g.fillStyle = red ? '#0b0608' : b.eyeSize > 1.2 ? '#1a0f08' : '#f2ead2';
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = hsl(b.color, -25); g.lineWidth = Math.max(1, r * 0.25); g.stroke();
  if (!red && b.eyeSize <= 1.2) { g.fillStyle = '#120c08'; g.beginPath(); g.arc(x + r * 0.25, y, r * 0.55, 0, TAU); g.fill(); }
  g.fillStyle = red ? 'rgba(255,90,70,0.55)' : 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(x + r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); g.fill();
  if (b.eyeSize < 1) { // a heavy brow against the glare
    g.strokeStyle = hsl(b.color, -18); g.lineWidth = r * 0.7;
    g.beginPath(); g.moveTo(x - r * 1.3, y - r * 1.1); g.lineTo(x + r * 1.4, y - r * 1.25); g.stroke();
  }
}

function eyes(g, b, x, y, r, s) {
  if (!b.eyes) return;
  eye(g, b, x, y, r, s);
  if (b.eyes >= 3) eye(g, b, x - r * 2.1, y - r * 0.6, r * 0.7, s);
  if (b.eyes >= 4) eye(g, b, x - r * 0.4, y + r * 1.9, r * 0.6, s);
}

function feelers(g, b, x, y, s, t) {
  if (!b.feelers) return;
  g.strokeStyle = hsl(b.color, -10, 0.9); g.lineWidth = Math.max(1, s * 0.008);
  for (let i = 0; i < 2; i++) {
    const sw = Math.sin(t * 1.3 + i * 1.7) * s * 0.04;
    g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + s * 0.12, y - s * (0.12 + i * 0.05), x + s * 0.25 + sw, y - s * (0.05 + i * 0.1), x + s * 0.34 + sw, y + s * (0.02 - i * 0.04));
    g.stroke();
  }
}

function glowDots(g, b, x, y, w, h, t, n = 7) {
  if (!b.glow) return;
  const r = rng(Math.round(b.wobble * 1e6));
  g.save();
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * w, py = y + (r() - 0.5) * h, pr = 1 + r() * 1.4;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
    const gr = g.createRadialGradient(px, py, 0, px, py, pr * 4);
    gr.addColorStop(0, `hsla(${b.accent},95%,62%,${0.75 * pulse})`); gr.addColorStop(1, `hsla(${b.accent},95%,55%,0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr * 4, 0, TAU); g.fill();
  }
  g.restore();
}

function walker(g, b, s, t) {
  const squat = b.build === 'squat', lanky = b.build === 'lanky';
  const flyer = b.plan === 'flyer';
  const L = s * (flyer ? 0.5 : lanky ? 0.62 : squat ? 0.9 : 0.75);
  const Hb = L * (squat ? 0.42 : lanky ? 0.36 : 0.4);
  const legLen = s * (flyer ? 0.14 : squat ? 0.17 : lanky ? 0.5 : 0.3);
  const legW = s * (squat ? 0.085 : lanky ? 0.03 : 0.05);
  const cy = -legLen - Hb * 0.35 + Math.sin(t * 2) * s * 0.004;
  const pairs = Math.max(1, b.legs / 2);
  const hips = [];
  for (let i = 0; i < pairs; i++) hips.push(pairs === 1 ? 0 : -L * 0.32 + (L * 0.64 * i) / (pairs - 1));

  const leg = (hx, phase, far) => {
    const step = Math.sin(t * 3 + phase);
    const fx = hx + step * s * 0.03, lift = Math.max(0, -Math.cos(t * 3 + phase)) * s * 0.012;
    const kx = hx + (lanky ? s * 0.06 : s * 0.02), ky = cy + Hb * 0.3 + (legLen + Hb * 0.05) * 0.5;
    g.strokeStyle = far ? hsl(b.color, -20) : hsl(b.color, -6);
    g.lineCap = 'round';
    g.lineWidth = legW; g.beginPath(); g.moveTo(hx, cy + Hb * 0.2); g.lineTo(kx, ky); g.stroke();
    g.lineWidth = legW * 0.8; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, -lift); g.stroke();
    g.fillStyle = far ? hsl(b.color, -24) : hsl(b.color, -12);
    g.beginPath(); g.ellipse(fx + legW * 0.3, -lift - legW * 0.1, legW * 0.75, legW * 0.35, 0, 0, TAU); g.fill();
  };

  // Wing behind
  if (flyer) wing(g, b, -L * 0.05, cy - Hb * 0.3, s * 0.8, t, true);
  hips.forEach((hx, i) => leg(hx + s * 0.03, i * 1.9 + Math.PI, true));

  // Tail
  if (b.tail) {
    const sw = Math.sin(t * 1.4) * s * 0.03;
    g.fillStyle = hsl(b.color, -4);
    g.beginPath();
    g.moveTo(-L * 0.42, cy - Hb * 0.25);
    g.quadraticCurveTo(-L * 0.75, cy - Hb * 0.1 + sw, -L * (lanky ? 1.05 : 0.85), cy + Hb * 0.25 + sw);
    g.quadraticCurveTo(-L * 0.7, cy + Hb * 0.15 + sw * 0.5, -L * 0.4, cy + Hb * 0.25);
    g.closePath(); g.fill();
    outline(g, b, s); g.stroke();
  }

  // Sail on the back
  if (b.sail) {
    const n = 7;
    g.fillStyle = `hsla(${b.accent},55%,55%,0.55)`;
    g.beginPath(); g.moveTo(-L * 0.3, cy - Hb * 0.4);
    for (let i = 0; i <= n; i++) {
      const xx = -L * 0.3 + (L * 0.55 * i) / n;
      const hh = Hb * (0.9 + 0.7 * Math.sin((i / n) * Math.PI));
      g.lineTo(xx, cy - Hb * 0.35 - hh);
    }
    g.lineTo(L * 0.25, cy - Hb * 0.4); g.closePath(); g.fill();
    g.strokeStyle = `hsla(${b.accent},45%,35%,0.9)`; g.lineWidth = Math.max(1, s * 0.006);
    for (let i = 0; i <= n; i++) {
      const xx = -L * 0.3 + (L * 0.55 * i) / n;
      const hh = Hb * (0.9 + 0.7 * Math.sin((i / n) * Math.PI));
      g.beginPath(); g.moveTo(xx, cy - Hb * 0.35); g.lineTo(xx, cy - Hb * 0.35 - hh); g.stroke();
    }
  }

  // Body
  g.fillStyle = bodyFill(g, b, 0, cy, L, Hb);
  g.beginPath();
  g.moveTo(-L * 0.5, cy);
  g.bezierCurveTo(-L * 0.5, cy - Hb * 0.85, L * 0.1, cy - Hb * (squat ? 1.05 : 0.9), L * 0.45, cy - Hb * 0.45);
  g.bezierCurveTo(L * 0.55, cy - Hb * 0.1, L * 0.5, cy + Hb * 0.5, L * 0.2, cy + Hb * 0.55);
  g.bezierCurveTo(-L * 0.1, cy + Hb * 0.62, -L * 0.5, cy + Hb * 0.5, -L * 0.5, cy);
  g.closePath(); g.fill();
  g.save(); g.clip(); texture(g, b, -L * 0.5, cy - Hb, L, Hb * 2, s); g.restore();
  outline(g, b, s); g.stroke();

  if (b.armor) plates(g, b, -L * 0.38, L * 0.4, cy - Hb * 0.62, Hb, s);
  if (b.covering === 'fur') fur(g, b, L, Hb, cy, s);
  if (b.sacs) sacs(g, b, -L * 0.2, cy - Hb * 0.8, s, t);

  // Neck and head
  const hx = L * (lanky ? 0.62 : squat ? 0.55 : 0.6), hy = cy - Hb * (lanky ? 1.15 : squat ? 0.3 : 0.7);
  const hr = s * (squat ? 0.12 : 0.1);
  const nod = Math.sin(t * 1.1) * s * 0.008;
  g.fillStyle = hsl(b.color, 2);
  g.beginPath();
  g.moveTo(L * 0.25, cy - Hb * 0.5);
  g.quadraticCurveTo(hx - hr * 0.6, hy - hr * 0.2 + nod, hx - hr * 0.2, hy - hr * 0.6 + nod);
  g.lineTo(hx + hr * 0.2, hy + hr * 0.6 + nod);
  g.quadraticCurveTo(L * 0.4, cy, L * 0.42, cy + Hb * 0.1);
  g.closePath(); g.fill();
  head(g, b, hx, hy + nod, hr, s, t);

  if (flyer) wing(g, b, -L * 0.02, cy - Hb * 0.35, s * 0.85, t, false);
  hips.forEach((hx2, i) => leg(hx2, i * 1.9, false));
  return -hy + hr * 0.8; // the top of its head, above the ground
}

function head(g, b, x, y, r, s, t) {
  g.fillStyle = hsl(b.color, 4);
  g.beginPath();
  g.ellipse(x, y, r * 1.05, r * 0.82, -0.15, 0, TAU);
  g.moveTo(x + r * 0.6, y - r * 0.4);
  g.quadraticCurveTo(x + r * 1.9, y - r * 0.1, x + r * 1.7, y + r * 0.35); // snout
  g.quadraticCurveTo(x + r * 1.2, y + r * 0.75, x + r * 0.3, y + r * 0.7);
  g.fill();
  outline(g, b, s);
  g.beginPath(); g.ellipse(x, y, r * 1.05, r * 0.82, -0.15, Math.PI * 0.9, Math.PI * 1.75); g.stroke();
  g.beginPath(); g.moveTo(x + r * 0.6, y - r * 0.4); g.quadraticCurveTo(x + r * 1.9, y - r * 0.1, x + r * 1.7, y + r * 0.35);
  g.quadraticCurveTo(x + r * 1.2, y + r * 0.75, x + r * 0.3, y + r * 0.7); g.stroke();
  g.beginPath(); g.moveTo(x + r * 0.9, y + r * 0.42); g.lineTo(x + r * 1.6, y + r * 0.33); g.stroke(); // mouth
  eyes(g, b, x + r * 0.45, y - r * 0.15, r * 0.24 * b.eyeSize, s);
  feelers(g, b, x + r * 0.5, y - r * 0.6, s, t);
}

function texture(g, b, x, y, w, h, s) {
  const r = rng(Math.round(b.wobble * 1e6) + 3);
  if (b.covering === 'scales' || b.covering === 'crystal') {
    g.strokeStyle = hsl(b.color, -12, 0.5); g.lineWidth = Math.max(0.8, s * 0.004);
    const d = Math.max(5, s * 0.035);
    for (let yy = y; yy < y + h; yy += d * 0.6) for (let xx = x + ((yy / d) % 2) * d * 0.5; xx < x + w; xx += d) {
      g.beginPath(); g.arc(xx, yy, d * 0.5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    }
  } else if (b.covering !== 'fur') { // spots
    g.fillStyle = `hsla(${b.accent},${Math.min(60, b.color.s + 15)}%,${b.color.l > 50 ? b.color.l - 20 : b.color.l + 18}%,0.45)`;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(x + r() * w, y + r() * h * 0.6, s * (0.01 + r() * 0.02), 0, TAU); g.fill(); }
  }
}

function plates(g, b, x0, x1, y, Hb, s) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const lift = Math.sin((i / (n - 1)) * Math.PI) * Hb * 0.25;
    g.fillStyle = hsl(b.color, -8 + i * 2); outline(g, b, s);
    g.beginPath(); g.ellipse(x, y - lift, (x1 - x0) / (n - 1) * 0.7, Hb * 0.32, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
  }
}

function fur(g, b, L, Hb, cy, s) {
  g.strokeStyle = hsl(b.color, 6, 0.9); g.lineWidth = Math.max(1, s * 0.006);
  const r = rng(Math.round(b.wobble * 1e6) + 9);
  for (let i = 0; i < 70; i++) {
    const a = Math.PI + (i / 70) * Math.PI;
    const x = Math.cos(a) * L * 0.5, y = cy + Math.sin(a) * Hb * 0.8;
    const len = s * (0.02 + r() * 0.025);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len * 0.6 - len * 0.3, y + Math.sin(a) * len); g.stroke();
  }
}

function sacs(g, b, x, y, s, t) {
  for (let i = 0; i < 3; i++) {
    const pulse = 1 + 0.12 * Math.sin(t * 1.6 + i * 0.8);
    const rr = s * (0.06 - i * 0.008) * pulse;
    g.fillStyle = `hsla(${(b.accent + 20) % 360},55%,72%,0.6)`;
    g.strokeStyle = `hsla(${(b.accent + 20) % 360},40%,45%,0.8)`; g.lineWidth = Math.max(1, s * 0.005);
    g.beginPath(); g.arc(x + i * s * 0.1, y - rr * 0.4, rr, 0, TAU); g.fill(); g.stroke();
  }
}

function wing(g, b, x, y, span, t, far) {
  // A membrane on three long fingers, rising and falling from the shoulder.
  const flap = Math.sin(t * 2.2) * 0.55;
  g.save(); g.translate(x, y); g.rotate(-0.15 + flap + (far ? -0.25 : 0));
  const tips = [[-span * 0.05, -span * 0.95], [-span * 0.42, -span * 0.75], [-span * 0.62, -span * 0.38]];
  g.fillStyle = far ? `hsla(${b.accent},35%,28%,0.8)` : `hsla(${b.accent},50%,52%,0.72)`;
  g.beginPath(); g.moveTo(0, 0);
  g.quadraticCurveTo(span * 0.12, -span * 0.55, tips[0][0], tips[0][1]);
  g.quadraticCurveTo(-span * 0.18, -span * 0.7, tips[1][0], tips[1][1]);
  g.quadraticCurveTo(-span * 0.4, -span * 0.5, tips[2][0], tips[2][1]);
  g.quadraticCurveTo(-span * 0.35, -span * 0.15, -span * 0.3, span * 0.02);
  g.closePath(); g.fill();
  g.strokeStyle = hsl(b.color, far ? -25 : -15, 0.9); g.lineWidth = Math.max(1, span * 0.014);
  for (const [tx, ty] of tips) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(tx * 0.3, ty * 0.6, tx, ty); g.stroke(); }
  g.restore();
}

function swimmer(g, b, s, t) {
  const kind = b.build === 'lanky' ? 'eel' : b.build === 'squat' ? 'ray' : 'fish';
  const L = s * 0.95;
  if (kind === 'eel') {
    const n = 40;
    for (let i = n; i >= 0; i--) {
      const u = i / n;
      const x = L * (0.5 - u), y = Math.sin(u * 7 - t * 3) * s * 0.06 * u;
      const r = s * 0.085 * (1 - u * 0.8) * (u < 0.08 ? 0.75 + u * 3 : 1);
      g.fillStyle = hsl(b.color, -i * 0.3 + 6);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    glowDots(g, b, 0, 0, L * 0.8, s * 0.08, t, 10);
    eyes(g, b, L * 0.45, -s * 0.015, s * 0.018 * b.eyeSize, s);
    feelers(g, b, L * 0.5, -s * 0.02, s * 0.6, t);
    return L;
  }
  const H = kind === 'ray' ? s * 0.22 : s * 0.3;
  const sw = Math.sin(t * 2.4) * s * 0.05;
  // Tail fluke
  g.fillStyle = hsl(b.color, -6);
  g.beginPath(); g.moveTo(-L * 0.38, 0);
  if (kind === 'ray') { g.quadraticCurveTo(-L * 0.6, sw * 0.5, -L * 0.75, sw); g.lineWidth = Math.max(1.5, s * 0.012); g.strokeStyle = hsl(b.color, -10); g.stroke(); }
  else { g.lineTo(-L * 0.58, -H * 0.55 + sw); g.quadraticCurveTo(-L * 0.5, sw, -L * 0.58, H * 0.55 + sw); g.closePath(); g.fill(); outline(g, b, s); g.stroke(); }
  // Fins
  g.fillStyle = `hsla(${b.accent},40%,${Math.min(70, b.color.l + 10)}%,0.75)`;
  if (kind === 'ray') {
    const flap = Math.sin(t * 1.8) * H * 0.5;
    g.beginPath(); g.moveTo(-L * 0.2, 0); g.quadraticCurveTo(0, -H * 1.6 - flap, L * 0.25, -H * 0.2); g.closePath(); g.fill();
  } else {
    g.beginPath(); g.moveTo(-L * 0.1, -H * 0.42); g.quadraticCurveTo(-L * 0.05, -H * 0.95, L * 0.12, -H * 0.45); g.closePath(); g.fill();
  }
  // Body
  g.fillStyle = bodyFill(g, b, 0, 0, L, H);
  g.beginPath();
  g.moveTo(L * 0.5, 0);
  g.bezierCurveTo(L * 0.45, -H * 0.6, -L * 0.1, -H * 0.55, -L * 0.4, -H * 0.08);
  g.lineTo(-L * 0.4, H * 0.08);
  g.bezierCurveTo(-L * 0.1, H * 0.5, L * 0.4, H * 0.55, L * 0.5, 0);
  g.closePath(); g.fill();
  g.save(); g.clip(); texture(g, b, -L * 0.4, -H * 0.5, L * 0.9, H, s); g.restore();
  outline(g, b, s); g.stroke();
  // Gill slits and a side fin
  g.strokeStyle = hsl(b.color, -18, 0.8); g.lineWidth = Math.max(1, s * 0.006);
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(L * (0.28 - i * 0.035), -H * 0.18); g.quadraticCurveTo(L * (0.25 - i * 0.035), 0, L * (0.28 - i * 0.035), H * 0.18); g.stroke(); }
  if (kind === 'fish') {
    g.fillStyle = `hsla(${b.accent},40%,${Math.min(70, b.color.l + 10)}%,0.8)`;
    const f = Math.sin(t * 2) * H * 0.1;
    g.beginPath(); g.moveTo(L * 0.18, H * 0.12); g.quadraticCurveTo(L * 0.05, H * 0.45 + f, -L * 0.02, H * 0.42 + f); g.quadraticCurveTo(L * 0.08, H * 0.2, L * 0.18, H * 0.12); g.fill();
  }
  glowDots(g, b, 0, H * 0.05, L * 0.7, H * 0.5, t, 9);
  if (b.glow) { // a lure
    const lx = L * 0.62, ly = -H * 0.75 + Math.sin(t * 1.5) * s * 0.01;
    g.strokeStyle = hsl(b.color, -5); g.lineWidth = Math.max(1, s * 0.006);
    g.beginPath(); g.moveTo(L * 0.38, -H * 0.35); g.quadraticCurveTo(L * 0.5, -H * 0.95, lx, ly); g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(lx, ly, 0, lx, ly, s * 0.05);
    gr.addColorStop(0, `hsla(${b.accent},95%,75%,0.95)`); gr.addColorStop(1, `hsla(${b.accent},95%,70%,0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, s * 0.05, 0, TAU); g.fill(); g.restore();
  }
  eyes(g, b, L * 0.38, -H * 0.12, s * 0.022 * b.eyeSize, s);
  feelers(g, b, L * 0.46, H * 0.05, s * 0.7, t);
  return L * (kind === 'ray' ? 1.25 : 1.08);
}

function floater(g, b, s, t) {
  const flat = b.build === 'squat';
  const pulse = 1 + 0.03 * Math.sin(t * 1.2);
  const R = s * (flat ? 0.48 : 0.34) * pulse, Rh = flat ? R * 0.32 : R * 0.9;
  const bob = Math.sin(t * 0.7) * s * 0.015;
  g.save(); g.translate(0, bob);
  // Tentacles
  const n = flat ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const x0 = -R * 0.8 + (R * 1.6 * i) / (n - 1);
    const len = s * (flat ? 0.18 : 0.5) * (0.7 + 0.3 * Math.sin(i * 2.3));
    g.strokeStyle = `hsla(${b.color.h},${b.color.s}%,${b.color.l + 10}%,0.7)`;
    g.lineWidth = Math.max(1, s * (flat ? 0.006 : 0.01));
    g.beginPath(); g.moveTo(x0, Rh * 0.2);
    for (let k = 1; k <= 10; k++) { const u = k / 10; g.lineTo(x0 + Math.sin(u * 4 + t * 1.5 + i) * s * 0.025 * u, Rh * 0.2 + len * u); }
    g.stroke();
  }
  // Fins
  g.fillStyle = `hsla(${b.accent},45%,60%,0.45)`;
  const fl = Math.sin(t * 1.3) * 0.2;
  for (const side of [-1, 1]) {
    g.beginPath(); g.moveTo(side * R * 0.85, 0);
    g.quadraticCurveTo(side * R * 1.45, -Rh * (0.5 + fl), side * R * 1.35, Rh * 0.3);
    g.closePath(); g.fill();
  }
  // Gas bag
  const grad = g.createRadialGradient(-R * 0.3, -Rh * 0.5, R * 0.05, 0, 0, R * 1.05);
  grad.addColorStop(0, `hsla(${b.color.h},${b.color.s}%,${Math.min(92, b.color.l + 30)}%,0.85)`);
  grad.addColorStop(0.7, `hsla(${b.color.h},${b.color.s}%,${b.color.l}%,0.6)`);
  grad.addColorStop(1, `hsla(${b.color.h},${b.color.s}%,${b.color.l - 15}%,0.75)`);
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(0, 0, R, Rh, 0, Math.PI, TAU);
  g.bezierCurveTo(R * 0.9, Rh * 0.35, -R * 0.9, Rh * 0.35, -R, 0);
  g.fill();
  outline(g, b, s); g.lineWidth = Math.max(1, s * 0.006); g.stroke();
  // Veins
  g.strokeStyle = `hsla(${b.accent},50%,45%,0.35)`;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * R * 0.12, Rh * 0.2); g.quadraticCurveTo(i * R * 0.3, -Rh * 0.5, i * R * 0.2, -Rh * 0.95); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.ellipse(-R * 0.35, -Rh * 0.55, R * 0.18, Rh * 0.12, -0.5, 0, TAU); g.fill();
  // Eyes along the rim
  if (b.eyes) for (let i = 0; i < Math.min(b.eyes, 4); i++) eye(g, b, -R * 0.45 + i * R * 0.3, Rh * 0.1, s * 0.016 * b.eyeSize, s);
  glowDots(g, b, 0, -Rh * 0.3, R * 1.4, Rh, t, 10);
  g.restore();
  return R * 2 / pulse;
}

function burrower(g, b, s, t) {
  const L = s * 0.95, n = 14;
  const r0 = s * (b.build === 'squat' ? 0.09 : 0.065);
  const path = u => [L * (0.5 - u), Math.sin(u * 5 + t * 0.8) * s * 0.035];
  // Tunnel behind it
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineCap = 'round'; g.lineWidth = r0 * 2.9;
  g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = path(i / 30 * 1.6 - 0.1); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  for (let i = n; i >= 0; i--) {
    const u = i / n, [x, y] = path(u);
    const r = r0 * (1 - u * 0.45);
    g.fillStyle = bodyFill(g, b, x, y, r, r);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    outline(g, b, s); g.lineWidth = Math.max(1, s * 0.006); g.stroke();
    if (b.covering === 'fur') { g.strokeStyle = hsl(b.color, 8, 0.8); for (let k = 0; k < 6; k++) { const a = -Math.PI * (0.2 + k * 0.12); g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); g.stroke(); } }
  }
  if (b.sacs) sacs(g, b, -L * 0.05, path(0.45)[1] - r0 * 0.9, s * 0.6, t);
  // Digging head
  const [hx, hy] = path(0);
  g.fillStyle = hsl(b.color, -14);
  g.beginPath(); g.moveTo(hx - r0 * 0.4, hy - r0 * 1.15); g.quadraticCurveTo(hx + r0 * 1.9, hy - r0 * 0.4, hx + r0 * 1.3, hy + r0 * 0.9); g.lineTo(hx - r0 * 0.2, hy + r0 * 0.9); g.closePath(); g.fill();
  outline(g, b, s); g.stroke();
  eyes(g, b, hx + r0 * 0.2, hy - r0 * 0.25, r0 * 0.18 * b.eyeSize, s);
  feelers(g, b, hx + r0 * 1.2, hy, s * 0.5, t);
  return L;
}

function plant(g, b, s, t) {
  const r = rng(Math.round(b.wobble * 1e6) + 5);
  const kind = b.build;
  const Hh = s * (kind === 'lanky' ? 1.1 : kind === 'squat' ? 0.38 : 0.75);
  const leaf = (x, y, len, ang) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = hsl(b.color, (r() - 0.5) * 10);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.28, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.28, 0, 0); g.fill();
    g.strokeStyle = hsl(b.color, -15, 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.9, 0); g.stroke();
    g.restore();
  };
  if (kind === 'squat') { // a cushion of leaves
    for (let i = 0; i < 60; i++) {
      const a = Math.PI + r() * Math.PI, d = r();
      leaf(Math.cos(a) * s * 0.4 * d, Math.sin(a) * Hh * d, s * (0.08 + r() * 0.06), a + (r() - 0.5));
    }
    return Hh;
  }
  const stems = kind === 'lanky' ? 1 : 3;
  for (let k = 0; k < stems; k++) {
    const x0 = (k - (stems - 1) / 2) * s * 0.18, top = Hh * (k === 1 || stems === 1 ? 1 : 0.75);
    const sway = u => Math.sin(t * 0.8 + k) * s * 0.03 * u * u;
    g.strokeStyle = `hsl(${(b.color.h + 300) % 360},25%,${Math.max(12, b.color.l - 12)}%)`;
    g.lineWidth = Math.max(2, s * (kind === 'lanky' ? 0.03 : 0.022));
    g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + s * 0.02, -top * 0.5, x0 + sway(1), -top); g.stroke();
    const nl = kind === 'lanky' ? 14 : 9;
    for (let i = 2; i <= nl; i++) {
      const u = i / nl, side = i % 2 ? 1 : -1;
      leaf(x0 + sway(u), -top * u, s * (0.2 - u * 0.1) * (kind === 'lanky' ? 0.7 : 1), side > 0 ? -0.5 - u * 0.4 : Math.PI + 0.5 + u * 0.4);
    }
  }
  return Hh;
}

function crawler(g, b, s, t) {
  if (b.crystals) {
    const W = s * 0.85, Hh = s * 0.3;
    const breathe = 1 + 0.02 * Math.sin(t * 0.9);
    // The rock-eater: a low dome studded with crystals, glowing where it digests stone.
    g.fillStyle = bodyFill(g, b, 0, -Hh * 0.5, W, Hh);
    g.beginPath(); g.moveTo(-W * 0.5, 0);
    g.bezierCurveTo(-W * 0.5, -Hh * 1.3 * breathe, W * 0.5, -Hh * 1.3 * breathe, W * 0.5, 0);
    g.closePath(); g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(255,120,40,0.75)'; g.lineWidth = Math.max(1, s * 0.006);
    const r = rng(Math.round(b.wobble * 1e6) + 11);
    for (let i = 0; i < 6; i++) { let x = (r() - 0.5) * W, y = -r() * Hh; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 3; j++) { x += (r() - 0.5) * s * 0.1; y += (r() - 0.5) * s * 0.05; g.lineTo(x, y); } g.stroke(); }
    g.restore();
    outline(g, b, s); g.stroke();
    for (let i = 0; i < 9; i++) { // crystals
      const u = (i + 0.5) / 9, x = -W * 0.42 + W * 0.84 * u;
      const base = -Hh * Math.sin(u * Math.PI) * 0.95 * breathe;
      const hh = s * (0.05 + 0.05 * Math.sin(i * 2.7) ** 2);
      g.fillStyle = `hsla(${b.accent},35%,${70 + (i % 3) * 6}%,0.9)`;
      g.beginPath(); g.moveTo(x - s * 0.02, base + 2); g.lineTo(x - s * 0.005, base - hh); g.lineTo(x + s * 0.02, base - hh * 0.6); g.lineTo(x + s * 0.025, base + 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.stroke();
    }
    if (b.eyes) for (let i = 0; i < Math.min(2, b.eyes); i++) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const ex = W * (0.3 + i * 0.08), ey = -Hh * 0.45;
      const gr = g.createRadialGradient(ex, ey, 0, ex, ey, s * 0.03);
      gr.addColorStop(0, 'rgba(255,200,90,0.95)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, s * 0.03, 0, TAU); g.fill(); g.restore();
    }
    return W;
  }
  // The tardigrade-like grain-clinger: a plump, segmented barrel on stubby clawed legs.
  const L = s * 0.8, Hh = s * 0.3;
  const cy = -Hh * 0.75;
  for (let i = 0; i < 4; i++) { // far legs
    const x = -L * 0.33 + i * L * 0.22, sw = Math.sin(t * 2.5 + i) * s * 0.015;
    g.strokeStyle = hsl(b.color, -18); g.lineWidth = s * 0.06; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + s * 0.02, cy); g.lineTo(x + s * 0.03 + sw, -s * 0.02); g.stroke();
  }
  g.fillStyle = bodyFill(g, b, 0, cy, L, Hh);
  g.beginPath(); g.ellipse(0, cy, L * 0.5, Hh * 0.62, 0, 0, TAU); g.fill();
  outline(g, b, s); g.stroke();
  g.strokeStyle = hsl(b.color, -14, 0.6);
  for (let i = 1; i < 5; i++) { const x = -L * 0.5 + i * L * 0.2; g.beginPath(); g.moveTo(x, cy - Hh * 0.55); g.quadraticCurveTo(x + L * 0.03, cy, x, cy + Hh * 0.55); g.stroke(); }
  // snout
  g.fillStyle = hsl(b.color, 4);
  g.beginPath(); g.ellipse(L * 0.5, cy + Hh * 0.05, L * 0.08, Hh * 0.22, 0, 0, TAU); g.fill(); outline(g, b, s); g.stroke();
  for (let i = 0; i < 4; i++) { // near legs and claws
    const x = -L * 0.33 + i * L * 0.22, sw = Math.sin(t * 2.5 + i + 1.5) * s * 0.015;
    g.strokeStyle = hsl(b.color, -4); g.lineWidth = s * 0.07;
    g.beginPath(); g.moveTo(x, cy + Hh * 0.2); g.lineTo(x + sw, -s * 0.02); g.stroke();
    g.strokeStyle = hsl(b.color, -30); g.lineWidth = Math.max(1, s * 0.008);
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + sw, -s * 0.01); g.lineTo(x + sw + k * s * 0.02 + s * 0.015, s * 0.012); g.stroke(); }
  }
  return L * 1.1;
}

// ---------- Colour helpers ----------

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = x => Math.round(clamp(k < 0 ? x * (1 + k) : x + (255 - x) * k, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function hex2rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
