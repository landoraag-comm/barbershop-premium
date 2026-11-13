// ===== Stage: renderer, studio environment, scroll-driven director =====
import * as THREE from 'three';
import { makeMaterials, buildRazor, buildScissors, buildPole, buildChair } from './models.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const P = (o = {}) => Object.assign({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 }, o);
const mix = (a, b, t) => { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k] ?? a[k], t); return o; };

export function createStage(canvas, opts = {}) {
  const reduced = !!opts.reduced;
  const mobile = matchMedia('(max-width:860px)').matches || matchMedia('(pointer:coarse)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  let maxDpr = mobile ? 2 : 1.6; let dpr = Math.min(devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100); camera.position.set(0, 0, 9);
  const CAMZ = 9; const FOV = 30;

  // --- studio environment (dark room with softboxes) ---
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene(); env.background = new THREE.Color(0x030303);
  { // graded dome: soft ceiling falling to a dark floor
    const g = new THREE.SphereGeometry(30, 32, 16); const col = []; const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 30; const v = y > 0 ? 0.05 + Math.pow(y, 1.6) * 0.42 : 0.03 + (1 + y) * 0.02; col.push(v * 1.05, v * 0.98, v * 0.92); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  }
  const soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#d8d8d8'); g.addColorStop(0.75, '#3a3a3a'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); return t; })();
  const box = (w, h, col, k, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); m.position.set(...pos); if (rot) m.rotation.set(...rot); env.add(m); };
  box(9, 3.2, 0xf4f1ec, 3.4, [0, 5.5, 0.5], [Math.PI / 2, 0, 0]);     // top softbox
  box(2.4, 9, 0xffb37a, 3.2, [-6, 0.5, 1.5], [0, Math.PI / 2, 0]);     // warm side strip
  box(1.4, 9, 0xcfe0ff, 2.4, [6, 0, -1], [0, -Math.PI / 2, 0]);       // cool rim strip
  box(7, 5, 0xfff6ec, 2.1, [-1.6, 1.8, 7], [0, Math.PI, 0]); box(4, 3, 0xffffff, 0.9, [2.8, -1.2, 6.5], [0, Math.PI, 0]);            // front fill
  box(14, 0.5, 0xffe9d2, 2.6, [0, -1.6, -6], null); box(1.2, 5, 0xffffff, 2.2, [-3.5, 1, -6], null);                 // low horizon line
  box(20, 20, 0x151210, 1, [0, -6, 0], [Math.PI / 2, 0, 0]);          // floor bounce
  scene.environment = pm.fromScene(env, 0.035).texture;

  const amb = new THREE.AmbientLight(0xffffff, 0.06); scene.add(amb);
  const key = new THREE.DirectionalLight(0xffd2a8, 2.4); key.position.set(-5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.6); rim.position.set(5, 2, -4); scene.add(rim);
  const sweep = new THREE.PointLight(0xfff0dc, 0, 7, 1.6); sweep.position.set(-4, 1, 2.5); scene.add(sweep);

  const M = makeMaterials();
  const razor = buildRazor(M), scissors = buildScissors(M), pole = buildPole(M), chair = buildChair(M);
  const objs = { razor, scissors, pole, chair };
  // warm-up: compile every shader and upload every texture before the first scroll
  const warm = [[-2.5, 0], [-0.8, 0], [0.8, 0], [2.5, 0]];
  Object.values(objs).forEach((o, n) => { scene.add(o); o.visible = true; o.position.set(warm[n][0], warm[n][1], -2); o.scale.setScalar(0.4); });
  renderer.compile(scene, camera);
  { const rt = new THREE.WebGLRenderTarget(64, 64); renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); rt.dispose(); }
  for (const o of Object.values(objs)) o.visible = false;

  // ---------- state ----------
  const st = {
    vw: innerWidth, vh: innerHeight, visH: 0, visW: 0,
    mouse: { x: 0, y: 0, sx: 0, sy: 0 }, t: 0, intro: 0, introStart: -1,
    svc: { kind: null, el: null }, poleDrag: 0, poleDragV: 0, polePowerOverride: null,
    chair: { rot: 0, rotT: 0, zoom: 0, zoomT: 0, lift: 0, recline: 0, spin: 0, spinT: 0, evT: -10, ev: null, sweep: -1 },
    cur: {}, open: { razor: 0.42, scissors: 0 }, poleSpin: 0, poleSpeed: 0,
    els: {}, onPole: null, frame: 0, slow: 0,
  };
  st.prev = {}; st.off = {}; st.openPrev = {}; st.openOff = {};
  for (const k of Object.keys(objs)) { st.cur[k] = P({ x: 0, y: -20, s: 0.001 }); st.prev[k] = {}; st.off[k] = {}; }
  const $ = (id) => document.getElementById(id);
  st.els = { hero: $('hero'), heroA: $('heroAnchor'), intro: $('intro'), scA: $('scissorsAnchor'), svc: $('servicos'), svcA: $('svcAnchor'), pole: $('poste'), poleA: $('poleAnchor'), book: $('agendar'), chairA: $('chairAnchor'), final: $('final'), finalA: $('finalAnchor') };

  function resize() {
    st.vw = innerWidth; st.vh = innerHeight;
    renderer.setSize(st.vw, st.vh, false);
    camera.aspect = st.vw / st.vh; camera.updateProjectionMatrix();
    st.visH = 2 * CAMZ * Math.tan(THREE.MathUtils.degToRad(FOV / 2)); st.visW = st.visH * camera.aspect;
  }
  resize();
  // mobile browsers resize the viewport while the URL bar slides; ignore small height-only changes
  let rq = 0; addEventListener('resize', () => { const dw = innerWidth !== st.vw, dh = Math.abs(innerHeight - st.vh); if (mobile && !dw && dh < 160) return; clearTimeout(rq); rq = setTimeout(resize, 120); });
  addEventListener('pointermove', (e) => { st.mouse.x = e.clientX / st.vw * 2 - 1; st.mouse.y = e.clientY / st.vh * 2 - 1; }, { passive: true });

  // screen rect -> world pose at z=0
  function anchorPose(el, size, fill = 0.9, fixedScroll = false, extra = {}) {
    const r = el.getBoundingClientRect();
    const top = fixedScroll ? r.top + scrollY : r.top;
    const cx = r.left + r.width / 2, cy = top + r.height / 2;
    const x = (cx / st.vw - 0.5) * st.visW, y = -(cy / st.vh - 0.5) * st.visH;
    const s = Math.max(0.05, (r.height / st.vh) * st.visH * fill / size);
    return P(Object.assign({ x, y, s }, extra));
  }
  const rectOf = (el) => el.getBoundingClientRect();
  const pinProg = (el) => { const r = rectOf(el); return clamp(-r.top / Math.max(1, r.height - st.vh)); };
  const enterProg = (el) => { const r = rectOf(el); return clamp(1 - r.top / st.vh); };   // 0 when top at bottom, 1 when top at top
  const leaveProg = (el) => { const r = rectOf(el); return clamp(1 - r.bottom / st.vh); }; // 0 while bottom below fold, 1 when bottom at top

  // ---------- public API ----------
  const api = {
    renderer, scene, objs, st, beforeFrame: null,
    startIntro() { st.introStart = st.t; },
    setService(kind, el) { st.svc.kind = kind; st.svc.el = el; },
    poleDragBy(dx) { st.poleDrag = clamp(st.poleDrag + dx * 0.006, -0.9, 0.9); },
    chairEvent(ev) {
      const c = st.chair; c.ev = ev; c.evT = st.t;
      if (ev === 'reset') { c.rotT = 0; c.zoomT = 0; c.spinT = c.spin; }
      if (ev === 'service') c.rotT = 0.42;
      if (ev === 'barber') c.rotT = 0.7;
      if (ev === 'date') { c.zoomT = 1; c.rotT = 0.82; }
      if (ev === 'time') { /* mechanical lift handled in loop */ }
      if (ev === 'confirm') { c.spinT = c.spin + Math.PI * 2; c.sweep = st.t; }
    },
    get dpr() { return dpr; },
    dispose() { renderer.setAnimationLoop(null); renderer.dispose(); },
  };

  // ---------- director ----------
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()); st.t += dt; const t = st.t;
    const k = 1 - Math.exp(-dt * (reduced ? 16 : 7.5));
    const decay = Math.exp(-dt * (reduced ? 14 : 5.2));
    if (api.beforeFrame) api.beforeFrame(performance.now());
    const m = st.mouse; m.sx += (m.x - m.sx) * (1 - Math.exp(-dt * 3)); m.sy += (m.y - m.sy) * (1 - Math.exp(-dt * 3));
    const E = st.els; const W = st.visW, H = st.visH;
    const intro = st.introStart < 0 ? 0 : ease((t - st.introStart) / (reduced ? 0.4 : 2.8));
    const float = reduced ? 0 : Math.sin(t * 0.8) * 0.06;

    // ---- section metrics
    const heroR = rectOf(E.hero); const h = clamp(-heroR.top / st.vh);
    const i = pinProg(E.intro), iEnter = enterProg(E.intro);
    const svcR = rectOf(E.svc); const svcVis = svcR.top < st.vh * 0.75 && svcR.bottom > st.vh * 0.25;
    const q = pinProg(E.pole), qEnter = enterProg(E.pole), qLeave = leaveProg(E.pole);
    const bEnter = enterProg(E.book), bLeave = leaveProg(E.book);
    const fEnter = enterProg(E.final), f = pinProg(E.final);

    // ===== RAZOR =====
    const rs = razor.userData.size;
    let rT, rOpen;
    const heroP = anchorPose(E.heroA, rs, mobile ? 0.95 : 0.9, true, { rz: -0.55, ry: 0.55, rx: 0.12 });
    heroP.y += float; heroP.z = -4.5 * (1 - intro); heroP.ry += -1.3 * (1 - intro) + m.sx * 0.32 * (1 - h); heroP.rx += m.sy * 0.18 * (1 - h); heroP.rz += m.sx * -0.05;
    const midP = P({ x: mobile ? -0.2 : heroP.x - W * 0.26, y: H * 0.06, z: -1.6, rx: 0.3, ry: heroP.ry + Math.PI * 0.95, rz: -1.05, s: heroP.s * 0.92 });
    const exitP = P({ x: -W * 1.15, y: H * 0.1, z: -3.2, rx: 0.4, ry: midP.ry + Math.PI * 0.8, rz: -1.5, s: heroP.s * 0.8 });
    const a = sstep(0, 1, h), b = sstep(0, 0.42, i);
    rT = mix(mix(heroP, midP, a), exitP, b); rOpen = lerp(lerp(0.42, 0.26, a), 0.0, sstep(0.05, 0.3, i));
    if (svcVis && st.svc.kind === 'barba' && st.svc.el) {
      rT = anchorPose(E.svcA, rs, 0.95, false, { rz: -0.5, ry: t * 0.9, rx: 0.2 }); rOpen = 1.1 + Math.sin(t * 1.3) * 0.25;
    }
    if (fEnter > 0.02) {
      const farP = P({ x: W * 0.8, y: H * 0.25, z: -4, rx: 0.4, ry: -2.2, rz: -0.3, s: heroP.s });
      // open razor composed as a V (handle down-left, blade out to the right), centred on its silhouette
      const frz = -0.52 + f * 0.08;
      const fp = anchorPose(E.finalA, rs, mobile ? 0.66 : 0.72, false, { z: mobile ? 0 : 0.3, rz: frz, ry: lerp(1.2, 0.22, ease(fEnter)) + f * 0.3 + m.sx * 0.1, rx: 0.12 + m.sy * 0.06 });
      fp.x += fp.s * (-1.03); fp.y += fp.s * (-0.1);
      fp.y += float * 0.6; fp.y += leaveProg(E.final) * H * 0.4;
      const w = ease(sstep(0.05, 0.85, fEnter));
      rT = mix(farP, fp, w); rOpen = lerp(0.3, 1.9, sstep(0.25, 0.9, fEnter));
    }
    // ===== SCISSORS =====
    const ss = scissors.userData.size;
    const offR = P({ x: W * 0.78, y: H * 0.15, z: -3, rx: 0.2, ry: -1.4, rz: 0.5, s: 0.4 });
    const scP = anchorPose(E.scA, ss, 0.92, false, { rx: 0.18 + m.sy * 0.06, ry: -0.15 + Math.sin(i * Math.PI * 1.4) * 0.55 + m.sx * 0.1, rz: -0.42 + i * 0.25 });
    scP.y += float * 0.7; offR.s = scP.s;
    const sa = ease(sstep(0.1, 0.42, i) + (mobile ? sstep(0.6, 1, iEnter) * 0 : 0));
    let sT = mix(offR, scP, sa);
    let sOpen = 0.06 + 0.55 * Math.pow(Math.sin(clamp((i - 0.3) / 0.7) * Math.PI * 2), 2) * sa;
    if (svcVis && st.svc.kind === 'corte' && st.svc.el) {
      sT = anchorPose(E.svcA, ss, 0.95, false, { rz: -0.6, ry: t * 0.7, rx: 0.2 }); sOpen = 0.35 + Math.sin(t * 2.2) * 0.3;
    }
    // ===== POLE =====
    const ps = pole.userData.size;
    const plP = anchorPose(E.poleA, ps, 0.92, false, { z: lerp(-1.2, 0.22, ease(q)), ry: st.poleDrag + Math.sin(t * 0.4) * 0.05, rx: 0.04, rz: 0 });
    const power = st.polePowerOverride ?? sstep(0.12, 0.72, q);
    const speedT = reduced ? 0.15 * power : sstep(0.3, 0.88, q) * 1.0 + (q >= 1 ? 1 : 0) * 0;
    st.poleSpeed += (speedT - st.poleSpeed) * (1 - Math.exp(-dt * 2));
    st.poleSpin += dt * st.poleSpeed * 2.4;
    if (!st.poleDragging) st.poleDrag *= Math.exp(-dt * 1.6);
    // ===== CHAIR =====
    const cs = chair.userData.size, c = st.chair;
    c.rot += (c.rotT - c.rot) * (1 - Math.exp(-dt * 3)); c.zoom += (c.zoomT - c.zoom) * (1 - Math.exp(-dt * 2.4));
    c.spin += (c.spinT - c.spin) * (1 - Math.exp(-dt * 1.9));
    const be = ease(sstep(0.05, 0.75, bEnter));
    const chP = anchorPose(E.chairA, cs, mobile ? 0.8 : 0.8, false, { z: c.zoom * 0.45, rx: 0.16 + m.sy * 0.03, ry: -0.62 + c.rot + c.spin + m.sx * 0.08 - (1 - be) * 1.6, rz: 0 });
    chP.y -= (1 - be) * H * 0.45; chP.y += bLeave * H * 0.3;
    // mechanical: time selection -> lift up/down + recline
    const te = c.ev === 'time' ? (t - c.evT) : 99;
    const liftA = te < 1.8 ? Math.sin(clamp(te / 1.8) * Math.PI) : 0;
    chair.userData.lift.position.y = 1.4 + liftA * 0.16;
    chair.userData.backTilt.rotation.x = -0.2 - liftA * 0.16;

    // ---- apply with damping
    const T = { razor: rT, scissors: sT, pole: plP, chair: chP };
    for (const name in objs) {
      const o = objs[name], cu = st.cur[name], tg = T[name];
      // scroll-locked follow: continuous (scroll-driven) motion is applied exactly, discrete jumps
      // (hover swaps, section hand-offs) are absorbed into an offset that eases out
      const pv = st.prev[name], of = st.off[name];
      for (const key in tg) { const v = tg[key];
        const th = key === 'x' || key === 'y' ? H * 0.22 : key === 'z' ? 0.9 : key === 's' ? Math.max(0.04, Math.abs(v) * 0.18) : 0.45;
        if (pv[key] !== undefined && Math.abs(v - pv[key]) > th) of[key] = (of[key] || 0) + pv[key] - v;
        of[key] = (of[key] || 0) * decay; pv[key] = v; cu[key] = v + of[key]; }
      o.position.set(cu.x, cu.y, cu.z); o.rotation.set(cu.rx, cu.ry, cu.rz); o.scale.setScalar(cu.s);
      const ext = 2.6 * cu.s * (o.userData.size || 3);
      o.visible = cu.s > 0.02 && Math.abs(cu.x) < W / 2 + ext && Math.abs(cu.y) < H / 2 + ext;
    }
    for (const [nm, v] of [['razor', rOpen], ['scissors', sOpen]]) { const p0 = st.openPrev[nm];
      if (p0 !== undefined && Math.abs(v - p0) > 0.3) st.openOff[nm] = (st.openOff[nm] || 0) + p0 - v;
      st.openOff[nm] = (st.openOff[nm] || 0) * decay; st.openPrev[nm] = v; st.open[nm] = v + st.openOff[nm]; }
    razor.userData.setOpen(st.open.razor); scissors.userData.setOpen(st.open.scissors);
    pole.userData.inner.rotation.y = -st.poleSpin; pole.userData.setPower(power);
    pole.userData.hl.position.x = -0.3 + Math.sin(t * 0.6) * 0.05;

    // ---- lights: entry reveal + sweeps
    key.intensity = 2.4 * (0.08 + 0.92 * intro); rim.intensity = 1.6 * (0.15 + 0.85 * intro);
    renderer.toneMappingExposure = 0.25 + 0.8 * intro;
    key.position.x = -5 + m.sx * 1.6; key.position.y = 3 - m.sy * 1.2;
    let sw = 0;
    if (st.introStart >= 0 && t - st.introStart < 2.4) { const u = (t - st.introStart) / 2.4; sweep.position.set(lerp(-5, 5, u), 0.8, 2.6); sw = Math.sin(u * Math.PI) * 30; }
    if (fEnter > 0.1) { sweep.position.set(lerp(-5, 6, f), 0.6 + st.cur.razor.y * 0.3, 3); sw = Math.max(sw, Math.sin(f * Math.PI) * 26); }
    if (c.sweep > 0 && t - c.sweep < 2.2) { const u = (t - c.sweep) / 2.2; sweep.position.set(st.cur.chair.x + lerp(-3, 3, u), st.cur.chair.y + 1, 2.5); sw = Math.sin(u * Math.PI) * 34; }
    if (c.ev && t - c.evT < 0.9 && c.ev !== 'confirm') { sweep.position.set(st.cur.chair.x - 1.5, st.cur.chair.y + 1.5, 2.2); sw = Math.max(sw, Math.sin((t - c.evT) / 0.9 * Math.PI) * 10); }
    sweep.intensity = sw;

    // camera micro-parallax
    camera.position.x = m.sx * 0.12; camera.position.y = -m.sy * 0.08; camera.lookAt(0, 0, 0);

    // ---- pole DOM sync
    if (st.onPole) st.onPole(q, power, qEnter, qLeave);

    const any = Object.values(objs).some((o) => o.visible);
    if (any) renderer.render(scene, camera); else if (st.frame % 30 === 0) renderer.clear();
    st.frame++;
    // dynamic resolution
    if (dt > 0.028) st.slow++; else st.slow = Math.max(0, st.slow - 0.5);
    if (st.slow > 45 && dpr > (mobile ? 1.5 : 1)) { dpr = Math.max(mobile ? 1.5 : 1, dpr - 0.25); renderer.setPixelRatio(dpr); renderer.setSize(st.vw, st.vh, false); st.slow = 0; }
  }
  renderer.setAnimationLoop(frame);
  api.onPole = (fn) => { st.onPole = fn; };
  api.setPoleDragging = (v) => { st.poleDragging = v; };
  return api;
}
