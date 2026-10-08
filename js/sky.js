// The viewscreen: draws the real sky from wherever the ship is, in WebGL.
// Stars are drawn by direction and by how bright they look from here, so moving the ship really changes the sky.
// Positions are uploaded relative to a moving origin (the star the ship is at), so float32 stays precise up close.
import { apparentMag, AU_PER_PC, SUN_RADIUS_AU } from './physics.js';

const NEAR_PC = 0.01; // stars closer than ~2,000 AU get drawn as discs with glare instead of points
const STREAKS = 700;

const STAR_VS = `
attribute vec3 a_pos; attribute float a_mag; attribute vec3 a_col;
uniform vec3 u_cam; uniform mat3 u_view; uniform mat4 u_proj; uniform float u_limit; uniform float u_px; uniform float u_maxSize;
varying vec3 v_col; varying float v_alpha;
void main() {
  vec3 d = a_pos - u_cam;
  float dist = length(d);
  if (dist < ${NEAR_PC.toFixed(4)}) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vec3 v = u_view * (d / dist);
  gl_Position = u_proj * vec4(v, 1.0);
  float m = a_mag + 5.0 * log2(dist) * 0.30103 - 5.0;
  float f = exp2(-1.328771 * (m - u_limit));
  gl_PointSize = clamp(2.0 * pow(f, 0.27), 1.6, u_maxSize) * u_px;
  v_alpha = clamp(0.16 * pow(f, 0.6), 0.0, 1.0);
  v_col = a_col;
}`;
const STAR_FS = `
precision mediump float;
varying vec3 v_col; varying float v_alpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-r * r * 6.0) + exp(-r * 3.0) * 0.22;
  gl_FragColor = vec4(v_col * core * v_alpha, 1.0);
}`;

const LINE_VS = `
attribute vec3 a_pos; attribute float a_alpha;
uniform vec3 u_cam; uniform mat3 u_view; uniform mat4 u_proj; varying float v_alpha;
void main() { v_alpha = a_alpha; gl_Position = u_proj * vec4(u_view * normalize(a_pos - u_cam), 1.0); }`;
const LINE_FS = `
precision mediump float; uniform vec4 u_color; varying float v_alpha;
void main() { gl_FragColor = u_color * v_alpha; }`;

const SKY_VS = `
attribute vec2 a_xy; varying vec2 v_xy;
void main() { v_xy = a_xy; gl_Position = vec4(a_xy, 0.0, 1.0); }`;
const SKY_FS = `
precision highp float;
varying vec2 v_xy; uniform mat3 u_view; uniform vec2 u_tan; uniform sampler2D u_tex; uniform float u_glow;
void main() {
  vec3 ray = normalize(vec3(v_xy * u_tan, -1.0));
  vec3 d = ray * u_view; // camera to world (the view matrix is a rotation)
  vec2 uv = vec2(atan(d.y, d.x) / 6.2831853 + 0.5, 0.5 - asin(clamp(d.z, -1.0, 1.0)) / 3.1415927);
  float g = texture2D(u_tex, uv).r;
  gl_FragColor = vec4(vec3(0.62, 0.68, 0.86) * g * u_glow + vec3(0.004, 0.006, 0.014), 1.0);
}`;

const SUN_VS = `
attribute vec2 a_xy; uniform vec2 u_center; uniform float u_extent; uniform vec2 u_res; varying vec2 v_px;
void main() { v_px = a_xy * u_extent; gl_Position = vec4((u_center + v_px) / u_res * 2.0 - 1.0, 0.0, 1.0); }`;
const SUN_FS = `
precision highp float;
varying vec2 v_px; uniform float u_disc; uniform float u_glow; uniform vec3 u_col; uniform float u_bright;
void main() {
  float d = length(v_px);
  float disc = 0.0;
  if (u_disc > 0.6) {
    float x = clamp(d / u_disc, 0.0, 1.0);
    disc = smoothstep(u_disc + 0.8, u_disc - 0.8, d) * (0.55 + 0.45 * pow(1.0 - x * x, 0.35));
  }
  float glow = exp(-d / u_glow * 2.4) * 0.9 + exp(-d / (u_glow * 3.0)) * 0.035;
  float spikes = (exp(-abs(v_px.x) / 1.2) + exp(-abs(v_px.y) / 1.2)) * exp(-d / (u_glow * 1.6)) * 0.3;
  vec3 c = u_col * (glow + spikes) * u_bright + mix(u_col, vec3(1.0), 0.4) * disc;
  gl_FragColor = vec4(c, 1.0);
}`;

const WARP_VS = `
attribute vec4 a_p; uniform mat4 u_proj; varying float v_a;
void main() { v_a = a_p.w; gl_Position = u_proj * vec4(a_p.xyz, 1.0); }`;
const WARP_FS = `
precision mediump float; varying float v_a; uniform float u_amount;
void main() { gl_FragColor = vec4(vec3(0.62, 0.78, 1.0) * v_a * u_amount, 1.0); }`;

export class Sky {
  constructor(canvas, catalog, milkyway) {
    this.canvas = canvas;
    this.cat = catalog;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
    this.origin = [0, 0, 0];

    this.starProg = program(gl, STAR_VS, STAR_FS);
    this.lineProg = program(gl, LINE_VS, LINE_FS);
    this.skyProg = program(gl, SKY_VS, SKY_FS);
    this.sunProg = program(gl, SUN_VS, SUN_FS);
    this.warpProg = program(gl, WARP_VS, WARP_FS);

    const n = catalog.count;
    this.relPos = new Float32Array(n * 3);
    this.posBuf = gl.createBuffer();
    this.magBuf = buffer(gl, catalog.absmag);
    this.colBuf = buffer(gl, catalog.color);
    const pairs = catalog.lines;
    this.linePos = new Float32Array(pairs.length * 6);
    this.lineBuf = gl.createBuffer();
    this.lineAlpha = new Float32Array(pairs.length * 2);
    this.lineAlphaBuf = gl.createBuffer();
    // How long each line is from Earth, so lines stretched by travel can fade out instead of slicing the sky.
    this.lineSpan = pairs.map(([a, b]) => angle(catalog.pos, a, b, [0, 0, 0]));
    this.quad = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    this.tri = buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, milkyway);

    // Warp streaks: dust in the ship's own frame, rushing past along the line of travel.
    this.streaks = new Float32Array(STREAKS * 4);
    this.streakVerts = new Float32Array(STREAKS * 8);
    for (let i = 0; i < STREAKS; i++) this.respawn(i, -Math.random() * 40);
    this.streakBuf = gl.createBuffer();

    this.setOrigin([0, 0, 0]);
  }

  respawn(i, z) {
    const a = Math.random() * Math.PI * 2, r = 0.25 + Math.pow(Math.random(), 0.6) * 3.2;
    this.streaks.set([Math.cos(a) * r, Math.sin(a) * r, z, 0.4 + Math.random() * 0.6], i * 4);
  }

  // Re-centres the positions on `o` (parsecs from the Sun, in doubles) and uploads them.
  setOrigin(o) {
    const { gl, cat } = this;
    this.origin = o.slice();
    const p = cat.pos;
    for (let i = 0; i < cat.count * 3; i += 3) {
      this.relPos[i] = p[i] - o[0]; this.relPos[i + 1] = p[i + 1] - o[1]; this.relPos[i + 2] = p[i + 2] - o[2];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.relPos, gl.STATIC_DRAW);
    cat.lines.forEach(([a, b], k) => {
      this.linePos.set(this.relPos.subarray(a * 3, a * 3 + 3), k * 6);
      this.linePos.set(this.relPos.subarray(b * 3, b * 3 + 3), k * 6 + 3);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.linePos, gl.STATIC_DRAW);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = dpr;
  }

  // View basis for a heading: yaw around the celestial pole, pitch above the celestial equator.
  static basis(yaw, pitch) {
    const cp = Math.cos(pitch);
    const f = [cp * Math.cos(yaw), cp * Math.sin(yaw), Math.sin(pitch)];
    let r = [f[1], -f[0], 0]; // f x north
    const rl = Math.hypot(r[0], r[1]) || 1;
    r = [r[0] / rl, r[1] / rl, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { f, r, u };
  }

  // Pixels (device) per unit of tan(angle): the field of view spans the geometric mean of width and height.
  focal(fov) {
    const { width, height } = this.canvas;
    return Math.sqrt(width * height) / 2 / Math.tan(fov / 2);
  }

  render(view) {
    this.resize();
    const { gl, cat } = this;
    const { width: W, height: H } = this.canvas;
    gl.viewport(0, 0, W, H);
    const { f, r, u } = Sky.basis(view.yaw, view.pitch);
    const mat = new Float32Array([r[0], u[0], -f[0], r[1], u[1], -f[1], r[2], u[2], -f[2]]);
    const focal = this.focal(view.fov);
    const proj = projection(2 * focal / W, 2 * focal / H);
    const cam = [view.cam[0] - this.origin[0], view.cam[1] - this.origin[1], view.cam[2] - this.origin[2]];
    this.last = { f, r, u, focal, W, H, cam: view.cam.slice() };

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Milky Way
    gl.disable(gl.BLEND);
    gl.useProgram(this.skyProg.p);
    gl.uniformMatrix3fv(this.skyProg.u.u_view, false, mat);
    gl.uniform2f(this.skyProg.u.u_tan, W / 2 / focal, H / 2 / focal);
    gl.uniform1f(this.skyProg.u.u_glow, view.glow ?? 0.32);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.skyProg.u.u_tex, 0);
    attr(gl, this.skyProg, 'a_xy', this.tri, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    clearAttrs(gl);
    gl.enable(gl.BLEND);

    // Constellation lines, fading as the ship gets far enough that they stop meaning anything
    if (view.lines && Math.hypot(...view.cam) < 60) {
      const fromSun = Math.hypot(...view.cam);
      const a = 0.16 * Math.min(1, Math.max(0, 1 - (fromSun - 10) / 50));
      gl.useProgram(this.lineProg.p);
      gl.uniform3fv(this.lineProg.u.u_cam, cam);
      gl.uniformMatrix3fv(this.lineProg.u.u_view, false, mat);
      gl.uniformMatrix4fv(this.lineProg.u.u_proj, false, proj);
      gl.uniform4f(this.lineProg.u.u_color, 0.45 * a, 0.7 * a, 0.95 * a, 1);
      attr(gl, this.lineProg, 'a_pos', this.lineBuf, 3);
      cat.lines.forEach(([i, j], k) => {
        const now = angle(cat.pos, i, j, view.cam);
        const stretch = now / Math.max(this.lineSpan[k], 1e-6);
        const fade = Math.min(1, Math.max(0, (3 - stretch) / 1.5)) * Math.min(1, Math.max(0, (0.7 - now) / 0.2));
        this.lineAlpha[k * 2] = this.lineAlpha[k * 2 + 1] = fade;
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineAlphaBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.lineAlpha, gl.DYNAMIC_DRAW);
      attr(gl, this.lineProg, 'a_alpha', this.lineAlphaBuf, 1);
      gl.drawArrays(gl.LINES, 0, cat.lines.length * 2);
      clearAttrs(gl);
    }

    // Stars
    const limit = 6.5 + Math.max(0, Math.log2(60 / (view.fov * 180 / Math.PI))) * 0.9;
    gl.useProgram(this.starProg.p);
    gl.uniform3fv(this.starProg.u.u_cam, cam);
    gl.uniformMatrix3fv(this.starProg.u.u_view, false, mat);
    gl.uniformMatrix4fv(this.starProg.u.u_proj, false, proj);
    gl.uniform1f(this.starProg.u.u_limit, limit);
    gl.uniform1f(this.starProg.u.u_px, this.dpr);
    gl.uniform1f(this.starProg.u.u_maxSize, Math.min(30, this.maxPoint / this.dpr));
    attr(gl, this.starProg, 'a_pos', this.posBuf, 3);
    attr(gl, this.starProg, 'a_mag', this.magBuf, 1);
    attr(gl, this.starProg, 'a_col', this.colBuf, 3);
    gl.drawArrays(gl.POINTS, 0, cat.count);
    clearAttrs(gl);

    // Stars close enough to have a disc
    for (const i of this.nearStars(view.cam)) this.drawSun(i, view.cam, limit);

    if (view.warp > 0.001) this.drawWarp(view, proj);
  }

  nearStars(camAbs) {
    if (!this._near || this._nearKey !== this.origin.join()) {
      // Only stars within a parsec of the origin can ever be near: the ship parks at the origin's star.
      this._nearKey = this.origin.join();
      this._near = [];
      const p = this.relPos;
      for (let i = 0; i < this.cat.count; i++) if (Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) < 1) this._near.push(i);
    }
    return this._near.filter(i => this.cat.distanceFrom(i, camAbs) < NEAR_PC);
  }

  drawSun(i, camAbs, limit) {
    const { gl, cat } = this;
    const s = this.project(i);
    if (!s || s.behind) return;
    const dist = cat.distanceFrom(i, camAbs);
    const m = apparentMag(cat.absmag[i], dist);
    const flux = Math.pow(10, -0.4 * (m - limit));
    const discPx = (cat.radius[i] * SUN_RADIUS_AU / (dist * AU_PER_PC)) * this.last.focal;
    const glowPx = Math.min(Math.max(4 * Math.pow(flux, 0.15), 3), 260) * this.dpr * 0.35 + discPx * 0.6;
    gl.useProgram(this.sunProg.p);
    gl.uniform2f(this.sunProg.u.u_center, s.x * this.dpr, (this.canvas.height - s.y * this.dpr));
    gl.uniform1f(this.sunProg.u.u_extent, Math.max(glowPx * 5, discPx * 1.5));
    gl.uniform2f(this.sunProg.u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.sunProg.u.u_disc, discPx);
    gl.uniform1f(this.sunProg.u.u_glow, glowPx);
    gl.uniform3fv(this.sunProg.u.u_col, cat.color.subarray(i * 3, i * 3 + 3));
    gl.uniform1f(this.sunProg.u.u_bright, Math.min(1, 0.4 + Math.log10(flux) / 12));
    attr(gl, this.sunProg, 'a_xy', this.quad, 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    clearAttrs(gl);
  }

  drawWarp(view, proj) {
    const { gl } = this;
    const speed = view.warpSpeed ?? 60, dt = view.dt ?? 0.016;
    const len = 0.05 + speed * 0.012;
    for (let i = 0; i < STREAKS; i++) {
      const k = i * 4;
      this.streaks[k + 2] += speed * dt * this.streaks[k + 3];
      if (this.streaks[k + 2] > -0.2) this.respawn(i, -40 + Math.random() * 4);
      const [x, y, z, w] = this.streaks.subarray(k, k + 4);
      const fade = Math.min(1, (z + 40) / 8) * w;
      this.streakVerts.set([x, y, z, fade, x, y, z - len * w, 0], i * 8);
    }
    gl.useProgram(this.warpProg.p);
    gl.uniformMatrix4fv(this.warpProg.u.u_proj, false, proj);
    gl.uniform1f(this.warpProg.u.u_amount, view.warp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.streakBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.streakVerts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.warpProg.a.a_p);
    gl.vertexAttribPointer(this.warpProg.a.a_p, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, STREAKS * 2);
    clearAttrs(gl);
  }

  // Where a star (index) or a direction ({dir}) lands on screen, in CSS pixels, from the last frame drawn.
  project(target) {
    const L = this.last;
    if (!L) return null;
    let d;
    if (typeof target === 'number') {
      const p = this.cat.pos;
      d = [p[target * 3] - L.cam[0], p[target * 3 + 1] - L.cam[1], p[target * 3 + 2] - L.cam[2]];
    } else d = target.dir;
    const len = Math.hypot(...d);
    const z = (d[0] * L.f[0] + d[1] * L.f[1] + d[2] * L.f[2]) / len;
    const x = (d[0] * L.r[0] + d[1] * L.r[1] + d[2] * L.r[2]) / len;
    const y = (d[0] * L.u[0] + d[1] * L.u[1] + d[2] * L.u[2]) / len;
    if (z <= 0.01) return { behind: true };
    return { x: (L.W / 2 + x / z * L.focal) / this.dpr, y: (L.H / 2 - y / z * L.focal) / this.dpr, dist: len };
  }

  // The star a tap at (x, y) CSS pixels most likely meant: near the tap, and the brighter the better.
  pick(x, y, limit = 7) {
    const L = this.last, cat = this.cat;
    if (!L) return -1;
    let best = -1, bestScore = Infinity;
    const p = cat.pos;
    for (let i = 0; i < cat.count; i++) {
      const dx = p[i * 3] - L.cam[0], dy = p[i * 3 + 1] - L.cam[1], dz = p[i * 3 + 2] - L.cam[2];
      const len = Math.hypot(dx, dy, dz);
      const z = (dx * L.f[0] + dy * L.f[1] + dz * L.f[2]) / len;
      if (z <= 0.05) continue;
      const m = apparentMag(cat.absmag[i], len);
      if (m > limit) continue;
      const sx = (L.W / 2 + (dx * L.r[0] + dy * L.r[1] + dz * L.r[2]) / len / z * L.focal) / this.dpr;
      const sy = (L.H / 2 - (dx * L.u[0] + dy * L.u[1] + dz * L.u[2]) / len / z * L.focal) / this.dpr;
      const px = Math.hypot(sx - x, sy - y);
      if (px > 28) continue;
      const score = px + m * 4;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  // Turns a screen point into a heading, for aiming the view.
  directionAt(x, y) {
    const L = this.last;
    const cx = (x * this.dpr - L.W / 2) / L.focal, cy = -(y * this.dpr - L.H / 2) / L.focal;
    const d = [0, 1, 2].map(k => L.f[k] + L.r[k] * cx + L.u[k] * cy);
    const l = Math.hypot(...d);
    return d.map(v => v / l);
  }
}

// The angle between stars i and j seen from p, in radians.
function angle(pos, i, j, p) {
  const a = [pos[i * 3] - p[0], pos[i * 3 + 1] - p[1], pos[i * 3 + 2] - p[2]];
  const b = [pos[j * 3] - p[0], pos[j * 3 + 1] - p[1], pos[j * 3 + 2] - p[2]];
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  if (la < 1e-9 || lb < 1e-9) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb))));
}

function projection(sx, sy) {
  const n = 0.001, f = 10;
  return new Float32Array([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]);
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, a = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i++) {
    const name = gl.getActiveAttrib(p, i).name;
    a[name] = gl.getAttribLocation(p, name);
  }
  return { p, u, a };
}

function buffer(gl, data) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

function clearAttrs(gl) {
  for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(i);
}

function attr(gl, prog, name, buf, size) {
  const loc = prog.a[name];
  if (loc === undefined || loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}
