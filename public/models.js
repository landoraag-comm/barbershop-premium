// ===== Procedural studio models: razor, scissors, barber pole, barber chair =====
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;

// ---------- texture helpers ----------
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, srgb = true, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8; return t;
}
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// height field (Float32 0..1) -> normal map canvas
function normalFromHeight(h, w, H, strength = 2) {
  const [c, x] = cnv(w, H); const img = x.createImageData(w, H); const d = img.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < w; i++) {
    const l = h[j * w + ((i - 1 + w) % w)], r = h[j * w + ((i + 1) % w)];
    const u = h[((j - 1 + H) % H) * w + i], dn = h[((j + 1) % H) * w + i];
    let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1; const len = Math.hypot(nx, ny, nz);
    const k = (j * w + i) * 4; d[k] = (nx / len * .5 + .5) * 255; d[k + 1] = (ny / len * .5 + .5) * 255; d[k + 2] = (nz / len * .5 + .5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}

// Diamond-tufted leather: color + normal
export function makeLeather(base = [112, 52, 24], diamonds = 4, size = 512, seed = 7) {
  const r = rand(seed); const w = size, H = size;
  const h = new Float32Array(w * H);
  const [c, x] = cnv(w, H); const img = x.createImageData(w, H); const d = img.data;
  // low-freq mottling
  const noise = new Float32Array(64 * 64); for (let i = 0; i < noise.length; i++) noise[i] = r();
  const nz = (u, v) => { u = (u % 1 + 1) % 1 * 64; v = (v % 1 + 1) % 1 * 64; const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const a = noise[(j % 64) * 64 + i % 64], b = noise[(j % 64) * 64 + (i + 1) % 64], c2 = noise[((j + 1) % 64) * 64 + i % 64], e = noise[((j + 1) % 64) * 64 + (i + 1) % 64];
    return a + (b - a) * fu + (c2 - a) * fv + (a - b - c2 + e) * fu * fv; };
  for (let j = 0; j < H; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / H;
    let p = 0, stitch = 0;
    if (diamonds > 0) {
      const a = (u + v) * diamonds, b = (u - v) * diamonds + 100;
      const fa = a - Math.floor(a), fb = b - Math.floor(b);
      const ea = Math.min(fa, 1 - fa), eb = Math.min(fb, 1 - fb); const e = Math.min(ea, eb);
      p = Math.pow(Math.min(1, e * 2.2), .55); // puff
      const sw = 0.018; stitch = (e < sw && e > sw * .25 && (Math.floor((ea < eb ? b : a) * 26) % 2 === 0)) ? 1 : 0;
    } else p = .6;
    const grain = (r() - .5) * .07 + (nz(u * 5, v * 5) - .5) * .25 + (nz(u * 23, v * 23) - .5) * .08;
    h[j * w + i] = p * .85 + grain * .25 - stitch * .12;
    const shade = .55 + p * .55 + grain * .6;
    const k = (j * w + i) * 4;
    if (stitch) { d[k] = 196; d[k + 1] = 150; d[k + 2] = 108; }
    else { d[k] = Math.min(255, base[0] * shade); d[k + 1] = Math.min(255, base[1] * shade); d[k + 2] = Math.min(255, base[2] * shade); }
    d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // roughness: creases rougher, puffs a bit glossier
  const [rc, rx] = cnv(w, H); const ri = rx.createImageData(w, H);
  for (let i = 0; i < w * H; i++) { const v = 255 * (0.62 - h[i] * .22); ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = v; ri.data[i * 4 + 3] = 255; }
  rx.putImageData(ri, 0, 0);
  return { map: c, normal: normalFromHeight(h, w, H, diamonds > 0 ? 6 : 1.4), rough: rc };
}

export function leatherMat(L, rep = [1, 1], tint) {
  const m = new THREE.MeshPhysicalMaterial({
    map: tex(L.map, true, rep), normalMap: tex(L.normal, false, rep), roughnessMap: tex(L.rough, false, rep),
    normalScale: new THREE.Vector2(1, 1), roughness: 1, metalness: 0, clearcoat: .35, clearcoatRoughness: .45, sheen: .4, sheenRoughness: .6, sheenColor: new THREE.Color(0x5a2a14), envMapIntensity: .8,
  });
  if (tint) m.color.set(tint);
  return m;
}

// Tortoise / lacquered red wood for razor scales
function makeTortoise() {
  const [c, x] = cnv(512, 1024); const r = rand(41);
  const g = x.createLinearGradient(0, 0, 512, 0); g.addColorStop(0, '#4a0d05'); g.addColorStop(.5, '#7a2410'); g.addColorStop(1, '#3d0a04');
  x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
  x.filter = 'blur(14px)';
  for (let i = 0; i < 70; i++) { x.fillStyle = r() < .55 ? `rgba(160,58,22,${.25 + r() * .35})` : `rgba(28,5,2,${.3 + r() * .4})`;
    x.beginPath(); x.ellipse(r() * 512, r() * 1024, 18 + r() * 60, 60 + r() * 220, (r() - .5) * .5, 0, TAU); x.fill(); }
  x.filter = 'blur(3px)';
  for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(${r() < .5 ? '190,80,30' : '20,4,2'},${.12 + r() * .2})`;
    x.beginPath(); x.ellipse(r() * 512, r() * 1024, 3 + r() * 14, 12 + r() * 60, (r() - .5) * .4, 0, TAU); x.fill(); }
  x.filter = 'none';
  return c;
}

// Fluted / ribbed bump for chrome chassis & footplate
function makeRibs(n = 14, vertical = false) {
  const [c, x] = cnv(256, 256); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) { const p = (i + .5) / n * 256;
    const g = vertical ? x.createLinearGradient(p - 256 / n / 2, 0, p + 256 / n / 2, 0) : x.createLinearGradient(0, p - 256 / n / 2, 0, p + 256 / n / 2);
    g.addColorStop(0, '#3a3a3a'); g.addColorStop(.5, '#e8e8e8'); g.addColorStop(1, '#3a3a3a'); x.fillStyle = g;
    if (vertical) x.fillRect(p - 256 / n / 2, 0, 256 / n, 256); else x.fillRect(0, p - 256 / n / 2, 256, 256 / n); }
  return c;
}

// Lattice grille (footrest plates) as alpha + bump
function makeLattice() {
  const [c, x] = cnv(512, 128); x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#000'; const s = 32;
  for (let i = -1; i < 512 / s + 1; i++) for (let j = 0; j < 4; j++) {
    const cx = i * s + (j % 2) * s / 2 + s / 2, cy = j * s + s / 2;
    x.beginPath(); x.moveTo(cx, cy - 11); x.lineTo(cx + 9, cy); x.lineTo(cx, cy + 11); x.lineTo(cx - 9, cy); x.closePath(); x.fill();
  }
  x.strokeStyle = '#fff'; x.lineWidth = 10; x.strokeRect(0, 0, 512, 128);
  return c;
}

// Ornamental filigree band for pole collars
function makeFiligree() {
  const [c, x] = cnv(1024, 128); x.fillStyle = '#2b2b2b'; x.fillRect(0, 0, 1024, 128);
  x.strokeStyle = '#e8e8e8'; x.lineCap = 'round';
  x.lineWidth = 4; x.beginPath(); x.moveTo(0, 10); x.lineTo(1024, 10); x.moveTo(0, 118); x.lineTo(1024, 118); x.stroke();
  for (let i = 0; i < 16; i++) {
    const ox = i * 64; x.lineWidth = 5;
    x.beginPath(); x.moveTo(ox, 64); x.bezierCurveTo(ox + 10, 24, ox + 40, 24, ox + 40, 56); x.bezierCurveTo(ox + 40, 70, ox + 24, 72, ox + 24, 58); x.stroke();
    x.beginPath(); x.moveTo(ox + 64, 64); x.bezierCurveTo(ox + 54, 104, ox + 24, 104, ox + 24, 72); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(ox + 52, 34, 6, 0, TAU); x.stroke(); x.beginPath(); x.arc(ox + 12, 94, 6, 0, TAU); x.stroke();
  }
  return c;
}

// Barber pole stripes: seamless helix in UV space
function makeStripes() {
  const w = 256, h = 1024, turns = 2.2; const [c, x] = cnv(w, h); const img = x.createImageData(w, h); const d = img.data;
  const cols = [[200, 18, 24], [245, 243, 238], [22, 52, 168], [245, 243, 238]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let t = (j / h * turns + i / w); t = ((t % 1) + 1) % 1; const f = t * 4; const b = Math.floor(f), fr = f - b;
    const a = cols[b], nb = cols[(b + 1) % 4]; const s = fr > .96 ? (fr - .96) / .04 : 0; // soft edge
    const k = (j * w + i) * 4; d[k] = a[0] + (nb[0] - a[0]) * s; d[k + 1] = a[1] + (nb[1] - a[1]) * s; d[k + 2] = a[2] + (nb[2] - a[2]) * s; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const t = tex(c); return t;
}

export function radialTex(inner = 'rgba(0,0,0,.75)') {
  const [c, x] = cnv(256, 256); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return tex(c);
}

// ---------- shared materials ----------
export function makeMaterials() {
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe6e9ec, metalness: 1, roughness: .13, envMapIntensity: 1.45 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xe4e7ea, metalness: 1, roughness: .24, envMapIntensity: 1.5 });
  const steelSatin = new THREE.MeshPhysicalMaterial({ color: 0xbfc4c9, metalness: 1, roughness: .34, envMapIntensity: 1.05 });
  const nickel = new THREE.MeshPhysicalMaterial({ color: 0xcfc6b5, metalness: 1, roughness: .22 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd9ad62, metalness: 1, roughness: .25 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: .55, metalness: 0, clearcoat: .3, clearcoatRoughness: .5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: .9 });
  return { chrome, steel, steelSatin, nickel, gold, black, rubber };
}

// ---------- shaped-solid helper (blades with real thickness profiles) ----------
// outline(v) -> [xEdge, xSpine, y]; thick(u,v) -> thickness. mode 'sym' = centered, 'one' = z from 0 to t
function bladeGeo({ nu = 28, nv = 90, outline, thick, mode = 'sym' }) {
  const pos = [], uv = [], idx = [];
  const grid = [[], []];
  for (const side of [0, 1]) {
    for (let j = 0; j <= nv; j++) { const v = j / nv; const [xe, xs, y] = outline(v); const row = [];
      for (let i = 0; i <= nu; i++) { const u = i / nu; const t = thick(u, v); const x = xe + (xs - xe) * u;
        const z = mode === 'sym' ? (side ? -t / 2 : t / 2) : (side ? 0 : t);
        row.push(pos.length / 3); pos.push(x, y, z); uv.push(u, v); }
      grid[side].push(row); }
  }
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const quad = (a, b, c, d, out) => { // a b / c d ; orient by outward
    const n = new THREE.Vector3().subVectors(P(c), P(a)).cross(new THREE.Vector3().subVectors(P(b), P(a)));
    if (n.dot(out) < 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  };
  for (const side of [0, 1]) { const g = grid[side]; const out = new THREE.Vector3(0, 0, side ? -1 : 1);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) quad(g[j][i], g[j][i + 1], g[j + 1][i], g[j + 1][i + 1], out); }
  // side walls with duplicated verts (crisp edges)
  const dup = (k) => { const n = pos.length / 3; pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); uv.push(uv[k * 2], uv[k * 2 + 1]); return n; };
  const wall = (topList, botList, outFn) => { const T = topList.map(dup), Bt = botList.map(dup);
    for (let k = 0; k < T.length - 1; k++) quad(T[k], T[k + 1], Bt[k], Bt[k + 1], outFn(k)); };
  const top = grid[0], bot = grid[1]; const mid = outline(0.5); const dir = Math.sign(mid[1] - mid[0]) || 1;
  wall(top.map((r) => r[nu]), bot.map((r) => r[nu]), () => new THREE.Vector3(dir, 0, 0)); // spine side
  wall(top.map((r) => r[0]), bot.map((r) => r[0]), () => new THREE.Vector3(-dir, 0, 0));
  wall(top[nv], bot[nv], () => new THREE.Vector3(0, 1, 0).multiplyScalar(Math.sign(outline(1)[2] - outline(0)[2]) || 1));
  wall(top[0], bot[0], () => new THREE.Vector3(0, -1, 0).multiplyScalar(Math.sign(outline(1)[2] - outline(0)[2]) || 1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// fix side-wall outward for spine/edge depending on which x is larger
function fixWalls() {}

// brushed-metal roughness / bump (streaks along V)
let _brushed = null;
function brushed() {
  if (_brushed) return _brushed; const [c, x] = cnv(512, 512); const r = rand(77);
  x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { const v = 90 + r() * 90; x.fillStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.25})`; x.fillRect(r() * 512, 0, 0.6 + r() * 1.6, 512); }
  _brushed = c; return c;
}
function brushedSteel(color = 0xc9cdd1, rough = 0.3, rep = [4, 1]) {
  const t = tex(brushed(), false, rep);
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough * 1.55, roughnessMap: t, bumpMap: t, bumpScale: 0.04, envMapIntensity: 1.5, clearcoat: 0.15, clearcoatRoughness: rough * 0.6 });
}
function ovalDecal() { // polished recessed oval: dark rim, bright inner streak
  const [c, x] = cnv(128, 384);
  const g = x.createRadialGradient(64, 150, 6, 64, 192, 190); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#b9bec4'); g.addColorStop(0.82, '#4b4f55'); g.addColorStop(1, '#2a2c30');
  x.fillStyle = g; x.beginPath(); x.ellipse(64, 192, 62, 190, 0, 0, TAU); x.fill(); return tex(c);
}

// ---------- extra textures ----------
export function makeRosewood() {
  const [c, x] = cnv(256, 1024); const r = rand(12);
  const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#2a0d05'); g.addColorStop(0.5, '#5b2412'); g.addColorStop(1, '#2c0e06');
  x.fillStyle = g; x.fillRect(0, 0, 256, 1024);
  // long flowing grain lines
  for (let i = 0; i < 260; i++) {
    const x0 = r() * 256, amp = 4 + r() * 18, f = 0.004 + r() * 0.01, ph = r() * 6; const dark = r() < 0.6;
    x.strokeStyle = dark ? `rgba(18,5,2,${0.18 + r() * 0.35})` : `rgba(150,70,35,${0.10 + r() * 0.22})`; x.lineWidth = 0.6 + r() * 2.2;
    x.beginPath(); for (let y = 0; y <= 1024; y += 8) { const xx = x0 + Math.sin(y * f + ph) * amp + Math.sin(y * f * 3.1 + ph) * amp * 0.25; y ? x.lineTo(xx, y) : x.moveTo(xx, y); } x.stroke();
  }
  x.filter = 'blur(10px)'; for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${r() < .5 ? '120,48,20' : '15,4,2'},${0.15 + r() * 0.2})`; x.beginPath(); x.ellipse(r() * 256, r() * 1024, 20 + r() * 50, 80 + r() * 200, 0, 0, TAU); x.fill(); }
  x.filter = 'none'; return c;
}
function makeTortoiseBrown() {
  const [c, x] = cnv(512, 128); const r = rand(5); x.fillStyle = '#4a1d0a'; x.fillRect(0, 0, 512, 128);
  x.filter = 'blur(6px)'; for (let i = 0; i < 90; i++) { x.fillStyle = r() < .5 ? `rgba(176,92,34,${.3 + r() * .4})` : `rgba(20,6,2,${.4 + r() * .4})`; x.beginPath(); x.ellipse(r() * 512, r() * 128, 8 + r() * 30, 4 + r() * 14, r() * 3, 0, TAU); x.fill(); }
  x.filter = 'none'; return c;
}
function goldEmblemPole() { // barber-pole inlay
  const [c, x] = cnv(256, 512); x.clearRect(0, 0, 256, 512);
  const gold = x.createLinearGradient(40, 0, 216, 0); gold.addColorStop(0, '#9c6b28'); gold.addColorStop(0.45, '#f6d995'); gold.addColorStop(1, '#a8752d');
  x.fillStyle = gold; x.strokeStyle = gold;
  const R = (a, b, w, h, rr) => { x.beginPath(); x.roundRect(a, b, w, h, rr); x.fill(); };
  R(52, 24, 152, 34, 16); R(88, 4, 80, 26, 13); R(66, 56, 124, 20, 5);
  R(52, 454, 152, 34, 16); R(88, 482, 80, 26, 13); R(66, 436, 124, 20, 5);
  x.lineWidth = 12; x.strokeRect(74, 80, 108, 352);
  x.save(); x.beginPath(); x.rect(80, 86, 96, 340); x.clip();
  for (let k = -6; k < 14; k++) { x.beginPath(); const y0 = 86 + k * 52; x.moveTo(80, y0); x.lineTo(176, y0 - 70); x.lineTo(176, y0 - 44); x.lineTo(80, y0 + 26); x.closePath(); x.fill(); }
  x.restore(); return c;
}
function tangEtching() {
  const [c, x] = cnv(1024, 192); x.clearRect(0, 0, 1024, 192); x.strokeStyle = 'rgba(25,26,30,.85)'; x.fillStyle = 'rgba(25,26,30,.85)'; x.lineCap = 'round'; x.lineWidth = 3.5;
  const scroll = (ox, dir) => { for (let i = 0; i < 4; i++) { const cx = ox + dir * i * 70; x.beginPath(); x.moveTo(cx - dir * 40, 110); x.bezierCurveTo(cx - dir * 20, 50, cx + dir * 30, 50, cx + dir * 30, 92); x.bezierCurveTo(cx + dir * 30, 112, cx + dir * 6, 116, cx + dir * 4, 98); x.stroke();
    x.beginPath(); x.moveTo(cx, 120); x.bezierCurveTo(cx + dir * 20, 150, cx + dir * 50, 140, cx + dir * 60, 118); x.stroke(); } };
  scroll(380, -1); scroll(640, 1);
  // little scissors in the middle
  x.save(); x.translate(512, 96); x.lineWidth = 4;
  for (const s of [1, -1]) { x.save(); x.rotate(s * 0.35); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -78); x.stroke(); x.beginPath(); x.ellipse(s * 10, 34, 13, 17, 0, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(0, 0); x.lineTo(s * 6, 18); x.stroke(); x.restore(); }
  x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill(); x.restore();
  return c;
}
// polyline bar -> rounded extruded shape
function barGeo(pts, w0, w1, depth = 0.05, bevel = 0.022) {
  const L = [], R = []; const n = pts.length;
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; const nx = -dy / l, ny = dx / l; const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push(new THREE.Vector2(pts[i].x + nx * w, pts[i].y + ny * w)); R.push(new THREE.Vector2(pts[i].x - nx * w, pts[i].y - ny * w)); }
  const s = new THREE.Shape([...L, ...R.reverse()]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 6, curveSegments: 12 }); g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}

// ---------- RAZOR (wooden curved scales, wide polished blade) ----------
export function buildRazor(M) {
  const root = new THREE.Group(); root.name = 'razor';
  const inner = new THREE.Group(); root.add(inner);
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xe0b56a, metalness: 1, roughness: 0.18, clearcoat: 0.4, clearcoatRoughness: 0.1 });
  // scales: banana-curved, rounded rosewood with deep lacquer
  const sh = new THREE.Shape();
  sh.moveTo(-0.21, 0.18); sh.quadraticCurveTo(0, 0.38, 0.21, 0.18);
  sh.bezierCurveTo(0.28, -0.9, 0.33, -2.2, 0.3, -2.98); sh.quadraticCurveTo(0.27, -3.36, 0, -3.38); sh.quadraticCurveTo(-0.27, -3.36, -0.3, -2.98);
  sh.bezierCurveTo(-0.33, -2.2, -0.28, -0.9, -0.21, 0.18);
  const wood = tex(makeRosewood(), true, [1.1, 0.266]); wood.offset.set(0.39, 0.9); wood.wrapS = wood.wrapT = THREE.MirroredRepeatWrapping;
  const scaleMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9, sheen: 0.3, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x8a3a1c) });
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.055, bevelSize: 0.065, bevelSegments: 12, curveSegments: 72 }); sg.translate(0, 0, -0.01);
  const bend = (y) => { const t = (y + 1.5) / 1.52; return 0.2 * (1 - t * t); };
  { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); const yy = (y + 1.6) / 1.78;
      p.setX(i, p.getX(i) + bend(y)); p.setZ(i, z * (0.8 + 0.2 * (1 - Math.abs(yy))) + (z > 0 ? 0.024 * (1 - yy * yy) : 0)); } sg.computeVertexNormals(); }
  const s1 = new THREE.Mesh(sg, scaleMat); s1.position.z = 0.095; inner.add(s1);
  const s2 = new THREE.Mesh(sg, scaleMat); s2.position.z = -0.095; s2.scale.z = -1; inner.add(s2);
  // brass pins with domed heads
  const pinG = new THREE.CylinderGeometry(0.03, 0.03, 0.36, 20); pinG.rotateX(Math.PI / 2);
  const capG = new THREE.SphereGeometry(0.062, 32, 16, 0, TAU, 0, Math.PI / 2); capG.rotateX(Math.PI / 2); capG.scale(1, 1, 0.55);
  const ringG = new THREE.TorusGeometry(0.062, 0.008, 10, 40);
  for (const y of [0, -3.02]) {
    const pin = new THREE.Mesh(pinG, brass); pin.position.y = y; inner.add(pin);
    for (const s of [1, -1]) { const zc = s * (0.095 + 0.01 + 0.055 * 0.8 + 0.004); const c = new THREE.Mesh(capG, brass); c.position.set(bend(y), y, zc); if (s < 0) c.rotation.y = Math.PI; inner.add(c);
      const rg = new THREE.Mesh(ringG, M.black); rg.position.copy(c.position); inner.add(rg); }
  }
  const wedge = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.36, 0.12, 3, 0.03), scaleMat); wedge.position.set(bend(-3.0), -3.0, 0); inner.add(wedge);
  // gold barber-pole inlay
  const et = tex(goldEmblemPole());
  const emblemMat = new THREE.MeshStandardMaterial({ map: et, emissiveMap: et, emissive: 0xffffff, emissiveIntensity: 0.32, alphaTest: 0.4, metalness: 0.8, roughness: 0.26, polygonOffset: true, polygonOffsetFactor: -4 });
  // conform the inlay to the curved scale surface (project every vertex onto it)
  const eg = new THREE.PlaneGeometry(0.26, 0.52, 12, 24); eg.rotateZ(-0.9); eg.translate(bend(-1.95) + 0.005, -1.95, 0);
  { s1.updateMatrixWorld(true); const rc = new THREE.Raycaster(); const p = eg.attributes.position; const o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < p.count; i++) { o.set(p.getX(i), p.getY(i), 1); rc.set(o, d); const h = rc.intersectObject(s1, false)[0]; p.setZ(i, h ? h.point.z + 0.0025 : 0.185); }
    eg.computeVertexNormals(); }
  const emblem = new THREE.Mesh(eg, emblemMat); inner.add(emblem);

  // ----- blade
  const blade = new THREE.Group(); inner.add(blade);
  const steel = brushedSteel(0xe6e9ec, 0.2, [3, 1]);
  const polish = new THREE.MeshPhysicalMaterial({ color: 0xf0f2f4, metalness: 1, roughness: 0.05, envMapIntensity: 1.25 });
  const Y0 = -0.72, Y1 = -2.86, XE = -0.46, XS = 0.17, RE = 0.16, RS = 0.05;
  const thickB = (u) => { const ts = 0.07, te = 0.0025; if (u > 0.93) return ts; return te + (ts * 0.95 - te) * Math.pow(u / 0.93, 1.9); };
  // rounded toe: large radius on the edge corner, small one on the spine corner; samples densify toward the toe
  const yAt = (v) => Y0 + (Y1 - Y0) * (1 - Math.pow(1 - v, 1.7));
  const corner = (x0, R, d, dir) => d >= R ? x0 : x0 + dir * (R - Math.sqrt(Math.max(0, R * R - (R - d) * (R - d))));
  const xeAt = (y) => corner(XE, RE, y - Y1, 1), xsAt = (y) => corner(XS, RS, y - Y1, -1);
  const body = bladeGeo({ nu: 30, nv: 90, mode: 'sym', outline: (v) => { const y = yAt(v); return [xeAt(y), xsAt(y), y]; }, thick: (u, v) => { const y = yAt(v); const d = (y - Y1) / 0.05; return thickB(u) * (d < 1 ? 0.55 + 0.45 * Math.sqrt(Math.max(0, d)) : 1); } });
  blade.add(new THREE.Mesh(body, steel));
  // honed edge bevel follows the edge and wraps around the rounded toe
  blade.add(new THREE.Mesh(bladeGeo({ nu: 2, nv: 70, mode: 'sym', outline: (v) => { const y = Y0 - 0.02 + (Y1 + 0.004 - Y0 + 0.02) * (1 - Math.pow(1 - v, 1.7)); const xe = xeAt(y); const w = 0.032 * (1 - 0.6 * Math.max(0, 1 - (y - Y1) / RE)); return [xe - 0.001, xe + w, y]; }, thick: (u) => 0.0028 + u * 0.0048 }), polish));
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.03, Y0 - Y1 - RS, 0.071, 2, 0.008), polish); spine.position.set(XS - 0.012, (Y0 + Y1 + RS) / 2, 0); blade.add(spine);
  // satin toe face (end grind)
  // tang + curved shoulder (stabilizer)
  const ts = new THREE.Shape();
  ts.moveTo(-0.085, 0.12); ts.lineTo(-0.085, -0.42); ts.bezierCurveTo(-0.09, -0.62, -0.2, -0.7, XE, -0.74); ts.lineTo(XS, -0.74);
  ts.lineTo(XS, -0.3); ts.quadraticCurveTo(XS, -0.18, 0.1, -0.12); ts.lineTo(0.1, 0.12); ts.quadraticCurveTo(0.008, 0.19, -0.085, 0.12);
  const tangG = new THREE.ExtrudeGeometry(ts, { depth: 0.056, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 4, curveSegments: 32 }); tangG.translate(0, 0, -0.028);
  blade.add(new THREE.Mesh(tangG, steel));
  const jimpG = new THREE.BoxGeometry(0.016, 0.01, 0.074);
  for (let n = 0; n < 10; n++) { const j = new THREE.Mesh(jimpG, M.black); j.position.set(0.101, 0.07 - n * 0.026, 0); blade.add(j); }
  // etched scroll + scissors on the tang (both faces)
  const etT = tex(tangEtching()); const etMat = new THREE.MeshBasicMaterial({ map: etT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.116), etMat); e.position.set(0.02, -0.42, s * 0.0375); e.rotation.z = Math.PI / 2; if (s < 0) e.rotation.y = Math.PI; blade.add(e); }
  // tail hook
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0.0, 0.1, 0), new THREE.Vector3(0.06, 0.36, 0), new THREE.Vector3(0.2, 0.56, 0), new THREE.Vector3(0.36, 0.64, 0), new THREE.Vector3(0.48, 0.6, 0), new THREE.Vector3(0.52, 0.5, 0)]);
  const tailG = new THREE.TubeGeometry(tail, 60, 0.042, 18, false); tailG.scale(1, 1, 0.66); blade.add(new THREE.Mesh(tailG, polish));
  const tipS = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), polish); tipS.scale.z = 0.66; tipS.position.set(0.52, 0.5, 0); blade.add(tipS);

  inner.position.y = 1.45;
  root.userData.blade = blade;
  root.userData.setOpen = (a) => { blade.rotation.z = a; };
  root.userData.size = 3.6;
  return root;
}

// ---------- SCISSORS (offset barber shears, tortoise ring inserts, bronze dial) ----------
export function buildScissors(M) {
  const root = new THREE.Group(); root.name = 'scissors';
  const inner = new THREE.Group(); root.add(inner);
  const steel = brushedSteel(0xeef0f3, 0.14, [1, 3]); steel.envMapIntensity = 1.9;
  const polish = new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, metalness: 1, roughness: 0.05, envMapIntensity: 1.2 });
  const bronze = new THREE.MeshPhysicalMaterial({ color: 0xd2955f, metalness: 1, roughness: 0.22, clearcoat: 0.3 });
  const tort = new THREE.MeshPhysicalMaterial({ map: tex(makeTortoiseBrown(), true, [4, 1]), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.2, sheenColor: new THREE.Color(0x7a3a14) });
  const L = 2.05;
  function half(o) {
    const g = new THREE.Group();
    const out = (v) => { const w = 0.26 * Math.pow(1 - v, 0.95) + 0.008; const xe = 0.055 - 0.055 * Math.pow(v, 1.2); return [xe, xe - w, 0.05 + L * v]; };
    const thick = (u, v) => { const taper = 1 - 0.55 * v; const t = u < 0.22 ? 0.004 + 0.05 * Math.pow(u / 0.22, 0.6) : 0.054 - 0.016 * Math.pow((u - 0.22) / 0.78, 2); return t * taper; };
    g.add(new THREE.Mesh(bladeGeo({ nu: 24, nv: 80, mode: 'one', outline: out, thick }), steel));
    g.add(new THREE.Mesh(bladeGeo({ nu: 2, nv: 60, mode: 'one', outline: (v) => { const [xe, xs, y] = out(v); return [xe + 0.0008, xe - (xe - xs) * 0.2, y]; }, thick: (u, v) => (0.0045 + 0.034 * u) * (1 - 0.55 * v) + 0.0006 }), polish));
    // polished blade root / hub plate
    const hubS = new THREE.Shape(); hubS.moveTo(0.06, 0.32); hubS.quadraticCurveTo(0.2, 0.05, 0.12, -0.18); hubS.quadraticCurveTo(0, -0.3, -0.16, -0.16); hubS.quadraticCurveTo(-0.24, 0.05, -0.2, 0.3); hubS.closePath();
    const hubG = new THREE.ExtrudeGeometry(hubS, { depth: 0.046, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 4, curveSegments: 24 }); hubG.translate(0, 0, 0.004);
    g.add(new THREE.Mesh(hubG, polish));
    // shank bar -> ring
    const r = o.ring; const c0 = new THREE.Vector2(-0.04, -0.12);
    const curve = new THREE.CubicBezierCurve(c0, new THREE.Vector2(o.bend, -0.45), new THREE.Vector2(r.x + r.rx * 1.05, r.y + r.ry + 0.3), new THREE.Vector2(r.x + r.rx * 0.72, r.y + r.ry * 0.72));
    const bar = new THREE.Mesh(barGeo(curve.getPoints(40), 0.16, 0.1, 0.05, 0.022), polish); bar.position.z = 0.03; g.add(bar);
    // ring: polished thick torus + tortoise insert
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 28, 96), polish); ring.scale.set(r.rx, r.ry, 0.36); ring.position.set(r.x, r.y, 0.03); g.add(ring);
    const ins = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 20, 96), tort); ins.scale.set(r.rx, r.ry, 0.3); ins.position.set(r.x, r.y, 0.03); g.add(ins);
    if (o.rest) {
      const rc = new THREE.CatmullRomCurve3([new THREE.Vector3(r.x - r.rx * 0.95, r.y - r.ry * 0.2, 0.03), new THREE.Vector3(r.x - r.rx * 1.35, r.y - r.ry * 0.5, 0.03), new THREE.Vector3(r.x - r.rx * 1.6, r.y - r.ry * 1.0, 0.03), new THREE.Vector3(r.x - r.rx * 1.55, r.y - r.ry * 1.55, 0.03), new THREE.Vector3(r.x - r.rx * 1.25, r.y - r.ry * 1.85, 0.03)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(rc, 60, 0.042, 16, false), polish));
      const end = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), polish); end.scale.set(1, 1.5, 0.8); end.position.copy(rc.getPoint(1)); g.add(end);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 28), bronze); col.position.copy(rc.getPoint(0.22)); col.lookAt(rc.getPoint(0.3)); col.rotateX(Math.PI / 2); g.add(col);
    }
    if (o.bumper) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), bronze); b.scale.set(1, 0.8, 1); b.position.set(o.bumper[0], o.bumper[1], 0.03); g.add(b);
      const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 20), polish); bc.rotation.z = Math.PI / 2; bc.position.set(o.bumper[0] - 0.06, o.bumper[1], 0.03); g.add(bc); }
    return g;
  }
  // thumb blade (front): shorter shank, smaller ring
  const A = new THREE.Group(); A.add(half({ ring: { x: -0.44, y: -1.24, rx: 0.25, ry: 0.27 }, bend: -0.16, bumper: [-0.13, -0.92] })); A.position.z = 0.002;
  // finger blade (back), mirrored: longer reach, bigger ring with finger rest
  const Bg = new THREE.Group(); const hb = half({ ring: { x: -0.46, y: -1.3, rx: 0.28, ry: 0.3 }, bend: -0.16, rest: true }); hb.scale.set(-1, 1, -1); Bg.add(hb); Bg.position.z = -0.002;
  inner.add(A, Bg);
  // tension dial: knurled bronze ring + polished cap with lathe rings
  const dial = new THREE.Group(); dial.position.z = 0.062; inner.add(dial);
  const kn = makeRibs(48, true); const knT = tex(kn, false, [6, 1]);
  const knMat = bronze.clone(); knMat.bumpMap = knT; knMat.bumpScale = 3;
  const dG = new THREE.CylinderGeometry(0.135, 0.135, 0.06, 64, 1, true); dG.rotateX(Math.PI / 2); dial.add(new THREE.Mesh(dG, knMat));
  const capProf = [[0, 0.075], [0.06, 0.074], [0.1, 0.068], [0.118, 0.058], [0.124, 0.045], [0.135, 0.03], [0.135, -0.03]].map(([r, y]) => new THREE.Vector2(r, y));
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProf, 64), steel); cap.rotation.x = Math.PI / 2; dial.add(cap);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.004, 8, 64), polish); ring2.position.z = 0.07; dial.add(ring2);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 32), polish); nut.rotation.x = Math.PI / 2; nut.position.z = -0.074; inner.add(nut);
  inner.position.y = 0.35; inner.rotation.z = 0.05;
  root.userData.setOpen = (a) => { A.rotation.z = -a / 2; Bg.rotation.z = a / 2; dial.rotation.z = a * 0.6; };
  root.userData.size = 3.4;
  return root;
}

// ---------- BARBER POLE ----------
export function buildPole(M) {
  const root = new THREE.Group(); root.name = 'pole';
  const H = 1.62; // half height of glass
  // cap profile (r, y) from axis at top down to the neck
  const prof = [[0, 2.6], [0.12, 2.595], [0.3, 2.55], [0.43, 2.45], [0.52, 2.3], [0.555, 2.14], [0.56, 2.04], [0.6, 2.02], [0.7, 2.0], [0.74, 1.96], [0.745, 1.9], [0.73, 1.85], [0.66, 1.82], [0.58, 1.81], [0.56, 1.78], [0.55, 1.76], [0.5, 1.75]];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const capG = new THREE.LatheGeometry(pts, 96);
  const top = new THREE.Mesh(capG, M.chrome); root.add(top);
  const bot = new THREE.Mesh(capG, M.chrome); bot.scale.y = -1; root.add(bot);
  // ornate bands
  const fil = makeFiligree(); const ft = tex(fil, true, [3, 1]); const fb = tex(fil, false, [3, 1]);
  const bandMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: ft, bumpMap: fb, bumpScale: 2.5, metalness: 1, roughness: .3 });
  const bandG = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 96, 1, true);
  for (const s of [1, -1]) { const b = new THREE.Mesh(bandG, bandMat); b.position.y = s * 1.67; root.add(b);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.018, 10, 96), M.chrome); lip.rotation.x = Math.PI / 2; lip.position.y = s * (H + 0.0); root.add(lip); }
  // inner striped cylinder (emissive)
  const stripes = makeStripes(); stripes.repeat.set(1, 1);
  const innerMat = new THREE.MeshPhysicalMaterial({ map: stripes, emissiveMap: stripes, emissive: 0xffffff, emissiveIntensity: 0, roughness: .35, metalness: 0, clearcoat: .6 });
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, H * 2, 96, 1, true), innerMat); root.add(inner);
  // glass
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, H * 2, 96, 1, true), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 1.8, specularIntensity: 1, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0, side: THREE.DoubleSide, depthWrite: false }));
  glass.renderOrder = 2; root.add(glass);
  // glass edge highlights (thin vertical strips)
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.03, H * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  hl.position.set(-0.3, 0, 0.37); hl.rotation.y = -0.6; root.add(hl);
  const hl2 = hl.clone(); hl2.material = hl.material.clone(); hl2.material.opacity = .18; hl2.position.set(0.36, 0, 0.32); hl2.rotation.y = 0.8; root.add(hl2);
  // interior light & aura
  const light = new THREE.PointLight(0xffe2c8, 0, 4, 2); root.add(light);
  const auraM = new THREE.SpriteMaterial({ map: radialTex('rgba(255,215,180,.55)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const aura = new THREE.Sprite(auraM); aura.scale.set(3.2, 5.2, 1); aura.position.z = -0.4; root.add(aura);
  root.userData = {
    size: 5.2, inner, innerMat, glass, light, aura, hl, hl2, stripes,
    setPower(p) { innerMat.emissiveIntensity = p * 1.15; light.intensity = p * 6; auraM.opacity = p * .55; innerMat.color.setScalar(.35 + p * .65); hl.material.opacity = .15 + p * .3; },
  };
  return root;
}

// ---------- BARBER CHAIR ----------
export function buildChair(M) {
  const root = new THREE.Group(); root.name = 'chair';
  const L = makeLeather([118, 56, 26], 4, 512, 3); const Lp = makeLeather([104, 48, 22], 0, 256, 9);
  const leatherD = leatherMat(L, [1, 1]); const leatherSmall = leatherMat(L, [1, 1]);
  const leatherPlain = leatherMat(Lp, [2, 2]);
  const blackLeather = leatherMat(Lp, [2, 2], 0x2a2a2a); blackLeather.sheenColor.set(0x222222);
  const ribs = makeRibs(9); const ribT = tex(ribs, false, [1, 1]);
  const chromeRib = M.chrome.clone(); chromeRib.bumpMap = ribT; chromeRib.bumpScale = 6; chromeRib.roughness = .14;
  const lat = makeLattice(); const latT = tex(lat, false, [1, 1]);
  const grille = new THREE.MeshPhysicalMaterial({ color: 0xd8dade, metalness: 1, roughness: .25, alphaMap: latT, transparent: false, alphaTest: .5, side: THREE.DoubleSide, bumpMap: latT, bumpScale: 2 });
  const RB = (w, h, d, r, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r);

  // base
  const baseProf = [[0, 0.06], [1.12, 0.06], [1.18, 0.09], [1.19, 0.14], [1.1, 0.2], [0.85, 0.27], [0.55, 0.33], [0.47, 0.38], [0.45, 0.42]].map(([r, y]) => new THREE.Vector2(r, y));
  root.add(new THREE.Mesh(new THREE.LatheGeometry(baseProf, 96), M.chrome));
  const rub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.22, 0.07, 96), M.rubber); rub.position.y = 0.035; root.add(rub);
  // pedestal
  const pedProf = [[0.45, 0.42], [0.42, 0.5], [0.36, 1.0], [0.33, 1.25], [0.4, 1.27], [0.42, 1.33], [0.36, 1.36], [0.3, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  root.add(new THREE.Mesh(new THREE.LatheGeometry(pedProf, 96), M.steelSatin));
  // hydraulic pedal
  const pedalArm = new THREE.Mesh(RB(0.62, 0.06, 0.08, 0.02), M.chrome); pedalArm.position.set(0.55, 0.95, 0.15); pedalArm.rotation.y = -0.3; root.add(pedalArm);
  const pedal = new THREE.Mesh(RB(0.22, 0.04, 0.18, 0.015), M.black); pedal.position.set(0.86, 0.97, 0.25); pedal.rotation.y = -0.3; root.add(pedal);
  const pedJ = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), M.chrome); pedJ.position.set(0.3, 0.95, 0.06); pedJ.rotation.z = Math.PI / 2; root.add(pedJ);

  // lifting assembly
  const lift = new THREE.Group(); lift.position.y = 1.4; root.add(lift);
  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 64), M.chrome); swivel.position.y = 0.02; lift.add(swivel);
  // chassis with ribs
  const chassis = new THREE.Mesh(RB(1.72, 0.44, 1.56, 0.06), chromeRib); chassis.position.y = 0.28; lift.add(chassis);
  const chassisTop = new THREE.Mesh(RB(1.76, 0.06, 1.6, 0.025), M.chrome); chassisTop.position.y = 0.51; lift.add(chassisTop);
  // seat cushion
  const cushion = new THREE.Mesh(RB(1.5, 0.34, 1.42, 0.14, 6), leatherD); cushion.position.set(0, 0.7, 0.04); lift.add(cushion);
  const piping = new THREE.Mesh(RB(1.53, 0.05, 1.45, 0.024), leatherPlain); piping.position.set(0, 0.555, 0.04); lift.add(piping);

  // backrest (pivot near rear of seat)
  const backPivot = new THREE.Group(); backPivot.position.set(0, 0.62, -0.66); lift.add(backPivot);
  const backTilt = new THREE.Group(); backTilt.rotation.x = -0.2; backPivot.add(backTilt);
  const back = new THREE.Mesh(RB(1.46, 1.72, 0.34, 0.14, 6), leatherD); back.position.set(0, 0.92, 0); backTilt.add(back);
  const backShell = new THREE.Mesh(RB(1.5, 1.76, 0.12, 0.05), leatherPlain); backShell.position.set(0, 0.92, -0.2); backTilt.add(backShell);
  const backSide = new THREE.Mesh(RB(1.52, 0.06, 0.38, 0.025), leatherPlain); backSide.position.set(0, 1.79, -0.04); backTilt.add(backSide);
  // headrest
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 16), M.chrome); post.position.set(0, 1.98, -0.2); backTilt.add(post);
  const headG = new THREE.CapsuleGeometry(0.22, 0.52, 10, 32); headG.rotateZ(Math.PI / 2);
  const head = new THREE.Mesh(headG, leatherSmall); head.position.set(0, 2.24, -0.14); backTilt.add(head);
  const headCap1 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40), leatherPlain); headCap1.rotation.y = Math.PI / 2; headCap1.position.set(0.37, 2.24, -0.14); backTilt.add(headCap1);
  const headCap2 = headCap1.clone(); headCap2.position.x = -0.37; backTilt.add(headCap2);

  // armrests
  for (const s of [1, -1]) {
    const g = new THREE.Group(); g.position.x = s * 0.93; lift.add(g);
    const sup = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.45, 0.62), new THREE.Vector3(0, 0.7, 0.66), new THREE.Vector3(0, 0.88, 0.58), new THREE.Vector3(0, 1.02, 0.6)]);
    const supG = new THREE.TubeGeometry(sup, 20, 0.07, 12, false); supG.scale(1, 1, 1);
    g.add(new THREE.Mesh(supG, M.chrome));
    const supB = new THREE.Mesh(RB(0.1, 0.5, 0.14, 0.03), M.chrome); supB.position.set(0, 0.78, -0.3); g.add(supB);
    const pad = new THREE.Mesh(RB(0.26, 0.17, 1.5, 0.07, 5), blackLeather); pad.position.set(0, 1.1, 0.0); g.add(pad);
    const capE = new THREE.Mesh(RB(0.28, 0.2, 0.14, 0.02), M.chrome); capE.position.set(0, 1.1, 0.78); g.add(capE);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), M.nickel); bolt.rotation.z = Math.PI / 2; bolt.position.set(s * 0.06, 0.62, 0.64); g.add(bolt);
  }
  // recline lever
  const lever = new THREE.Group(); lever.position.set(0.9, 0.34, 0.25); lift.add(lever);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24), M.chrome); disc.rotation.z = Math.PI / 2; lever.add(disc);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 12), M.chrome); rod.position.set(0.05, 0.3, 0.06); rod.rotation.x = 0.2; lever.add(rod);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 24, 18), M.chrome); ball.position.set(0.05, 0.61, 0.12); lever.add(ball);

  // footrest
  const foot = new THREE.Group(); foot.position.set(0, 0.16, 0.78); foot.rotation.x = 0.62; lift.add(foot);
  for (const s of [1, -1]) { const rail = new THREE.Mesh(RB(0.07, 0.07, 1.25, 0.025), M.chrome); rail.position.set(s * 0.58, 0, 0.62); foot.add(rail); }
  const fpanel = new THREE.Mesh(RB(1.06, 0.07, 0.42, 0.03, 5), leatherD); fpanel.position.set(0, 0.02, 0.5); foot.add(fpanel);
  const gr1 = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.24), grille); gr1.rotation.x = -Math.PI / 2; gr1.position.set(0, 0.02, 0.15); foot.add(gr1);
  const gr2 = gr1.clone(); gr2.position.z = 0.86; foot.add(gr2);
  const footT = new THREE.Group(); footT.position.set(0, 0, 1.24); footT.rotation.x = -0.62; foot.add(footT);
  const plate = new THREE.Mesh(RB(1.12, 0.05, 0.48, 0.02), chromeRib); plate.position.set(0, -0.02, 0.22); footT.add(plate);
  const rollG = new THREE.CapsuleGeometry(0.11, 0.9, 8, 24); rollG.rotateZ(Math.PI / 2);
  const roll = new THREE.Mesh(rollG, leatherPlain); roll.position.set(0, 0.08, 0.5); footT.add(roll);
  const fstand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 16), M.chrome); fstand.position.set(0, -0.3, 0.26); footT.add(fstand);
  const fpad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20), M.rubber); fpad.position.set(0, -0.6, 0.26); footT.add(fpad);

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.85)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; root.add(shadow);

  const pivot = new THREE.Group(); root.position.y = -1.55; pivot.add(root);
  pivot.userData = { size: 3.6, lift, backTilt, root };
  return pivot;
}
