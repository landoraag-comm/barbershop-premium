// ===== App: UI, booking flow, admin, motion =====
import { DEFAULT_CONFIG, HOUSE, merge, activeBarbers, activeServices, availability, toMin, fmtMin, dayKey, parseKey, money, createStore } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer:coarse)').matches;
const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WDs = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fmtDate = (k) => { const d = parseKey(k); return `${WD[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const fmtPhone = (d) => { d = String(d).replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d ? `(${d}` : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };

let stage = null, lenis = null, store = null, lenisOwnLoop = true;
const B = { svc: null, barber: null, date: null, time: null, month: null, step: 1, busy: false, last: null };

// ---------------- boot ----------------
async function boot() {
  $('#yr').textContent = new Date().getFullYear();
  const L = loader(); L.step(0.12, 'Afiando a navalha');
  // ticks
  $('.ticks').innerHTML = '<i></i>'.repeat(26);
  // smooth scroll
  if (!reduced && window.Lenis && !touch) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    // until the 3D stage exists, drive Lenis ourselves; afterwards the stage drives it at the start of
    // every frame so DOM scroll and 3D are always computed from the same scroll position
    const raf = (t) => { if (lenisOwnLoop) { lenis.raf(t); requestAnimationFrame(raf); } }; requestAnimationFrame(raf);
  }
  bindNav(); bindCursor(); bindMagnetic(); bindReveals(); bindBooking(); bindPoleDrag();
  // data
  const storeP = createStore({ config: onConfig, slots: onSlots, media: onMedia, bookings: () => admin.refresh(), mode: onMode }).then((s) => { store = s; onMode(); onConfig(); });
  renderAll(merge(null));
  // 3D
  try { await document.fonts.ready; } catch (e) {}
  L.step(0.34, 'Aquecendo a toalha');
  try {
    const mod = await import('./stage.js');
    L.step(0.62, 'Polindo o cromo');
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    stage = mod.createStage($('#gl'), { reduced });
  } catch (e) { console.warn('3D indisponível', e); stage = null; }
  if (!stage) document.documentElement.classList.add('no-gl');
  else { stage.onPole(onPole); if (lenis) { lenisOwnLoop = false; stage.beforeFrame = (t) => lenis.raf(t); } }
  L.step(0.86, 'Ajustando a cadeira');
  await Promise.race([storeP, new Promise((r) => setTimeout(r, 2500))]);
  L.step(1, 'Pronto para o corte');
  await L.done();
  intro();
}

function loader() {
  const el = $('#loader'), num = $('#ldNum'), stepEl = $('#ldStep'), fill = $('#ldFillRect'), aura = $('#ldAura');
  // build helix stripes (red / white / blue / white, rising)
  const band = (y, col) => `<polygon points="18,${y} 62,${y - 22} 62,${y - 8} 18,${y + 14}" fill="${col}"/>`;
  let g = ''; for (let y = 30; y < 330; y += 56) g += band(y, '#c8141c') + band(y + 28, '#1d3a9e');
  $$('#loader .ld-stripes').forEach((s) => s.innerHTML = g);
  let target = 0, shown = 0, t0 = performance.now(), finished = null, lastMsg = 'Afiando a navalha';
  const MSGS = [[0.3, 'Afiando a navalha'], [0.55, 'Aquecendo a toalha'], [0.8, 'Polindo o cromo'], [0.97, 'Ajustando a cadeira'], [2, 'Pronto para o corte']];
  const tick = () => {
    shown = reduced ? target : Math.min(target, shown + Math.max((target - shown) * 0.07, 0.009));
    const h = 184 * shown; fill.setAttribute('y', String(242 - h)); fill.setAttribute('height', String(h));
    aura.setAttribute('opacity', String(shown * 0.5)); num.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    const msg = MSGS.find(([v]) => shown < v)[1]; if (msg !== lastMsg) { lastMsg = msg; stepEl.classList.add('out'); setTimeout(() => { stepEl.textContent = msg; stepEl.classList.remove('out'); }, 260); }
    if (finished && shown >= 0.999) { const f = finished; finished = null; f(); }
    if (!el.classList.contains('gone')) requestAnimationFrame(tick);
  }; requestAnimationFrame(tick);
  return {
    step(p) { target = Math.max(target, p); },
    done() { return new Promise((res) => { const minT = reduced ? 0 : 1300 - (performance.now() - t0); setTimeout(() => { finished = res; }, Math.max(0, minT)); }); },
  };
}
function intro() {
  const el = $('#loader'); const T = reduced ? 0 : 1;
  el.classList.add('done');
  setTimeout(() => { stage?.startIntro(); }, 380 * T);
  setTimeout(() => { el.classList.add('fade'); }, 520 * T);
  setTimeout(() => { el.classList.add('gone'); }, 1700 * T + 20);
  const base = 900 * T;
  setTimeout(() => $('#heroEye').classList.add('in'), base);
  setTimeout(() => $('#heroTitle').classList.add('in'), base + 150 * T);
  setTimeout(() => $('#heroLede').classList.add('in'), base + 600 * T);
  setTimeout(() => $('#heroCtas').classList.add('in'), base + 800 * T);
  setTimeout(() => { $('#heroMeta').classList.add('in'); $('#scrollCue').classList.add('in'); }, base + 1200 * T);
}

// ---------------- nav / scroll ----------------
function goTo(id) {
  const el = document.getElementById(id); if (!el) return;
  document.documentElement.classList.remove('menu-open'); $('#burger').setAttribute('aria-expanded', 'false');
  const y = id === 'agendar' ? el.getBoundingClientRect().top + scrollY - 10 : el.getBoundingClientRect().top + scrollY;
  if (lenis) lenis.scrollTo(y, { duration: Math.min(2.4, 0.8 + Math.abs(y - scrollY) / 4000) }); else scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
}
function bindNav() {
  document.addEventListener('click', (e) => { const a = e.target.closest('[data-go]'); if (!a) return; e.preventDefault(); goTo(a.dataset.go); });
  $('#burger').addEventListener('click', () => { const o = document.documentElement.classList.toggle('menu-open'); $('#burger').setAttribute('aria-expanded', String(o)); $('#mmenu').setAttribute('aria-hidden', String(!o)); });
  const nav = $('#nav'); const heroCopy = $('#heroCopy'), hideEls = $$('.hero-hide'), bgEl = $('#atmo .img'); const cap = $('#scissorsCap');
  const onScroll = () => {
    nav.classList.toggle('scrolled', scrollY > 40);
    const h = clamp(scrollY / innerHeight);
    for (const el of hideEls) { el.style.opacity = String(1 - sstep(0, 0.55, h)); }
    heroCopy.style.transform = `translate3d(0,${-h * 60}px,0)`;
    bgEl.style.transform = `translate3d(0,${-(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 6}%,0) scale(1.14)`;
    const ir = $('#intro').getBoundingClientRect(); const ip = clamp(-ir.top / (ir.height - innerHeight));
    cap.style.opacity = String(sstep(0.35, 0.5, ip) * (1 - sstep(0.92, 1, ip)));
  };
  let sq = false; addEventListener('scroll', () => { if (!sq) { sq = true; requestAnimationFrame(() => { sq = false; onScroll(); }); } }, { passive: true }); onScroll();
}

// ---------------- cursor / magnetic ----------------
function bindCursor() {
  if (touch) return; const c = $('#cur'), lab = $('span', c); let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  const loop = () => { x += (tx - x) * 0.22; y += (ty - y) * 0.22; c.style.transform = `translate3d(${x}px,${y}px,0)`; requestAnimationFrame(loop); }; loop();
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor]');
    c.classList.toggle('big', !!t && t.dataset.cursorMode !== 'drag'); c.classList.toggle('drag', !!t && t.dataset.cursorMode === 'drag');
    lab.textContent = t ? t.dataset.cursor : '';
  });
}
function bindMagnetic() {
  if (touch || reduced) return;
  // one batched read, then writes, at most once per frame; only buttons on screen
  let px = 0, py = 0, queued = false; const active = new Set();
  const run = () => { queued = false; const bs = $$('.magnetic'); const rects = bs.map((b) => b.getBoundingClientRect());
    bs.forEach((b, i) => { const r = rects[i]; if (r.bottom < 0 || r.top > innerHeight) { if (active.has(b)) { b.style.transform = ''; active.delete(b); } return; }
      const t = b._mt || [0, 0]; const cx = r.left - t[0] + r.width / 2, cy = r.top - t[1] + r.height / 2; const dx = px - cx, dy = py - cy;
      const inside = Math.abs(dx) < r.width / 2 + 24 && Math.abs(dy) < r.height / 2 + 24;
      if (inside) { b._mt = [dx * 0.12, dy * 0.22]; b.style.transition = 'transform .25s var(--ease)'; b.style.transform = `translate3d(${b._mt[0]}px,${b._mt[1]}px,0)`; active.add(b); }
      else if (active.has(b)) { b._mt = [0, 0]; b.style.transition = 'transform .8s var(--ease)'; b.style.transform = ''; active.delete(b); } }); };
  document.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!queued) { queued = true; requestAnimationFrame(run); } }, { passive: true });
}
function bindReveals() {
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  const watch = () => $$('[data-reveal]:not(.in), .ph:not(.in), .svc-list .hr:not(.in)').forEach((el) => io.observe(el));
  watch(); bindReveals.watch = watch;
}

// ---------------- pole ----------------
const STAGES = ['Em repouso', 'Ativação', 'Carregando o giro', 'Intensidade', 'Em funcionamento'];
const poleCache = {};
const setIf = (k, v, fn) => { if (poleCache[k] !== v) { poleCache[k] = v; fn(v); } };
function onPole(q, power, enter) {
  const qq = Math.round(q * 1000) / 1000;
  setIf('bar', qq, (v) => { $('#poleBar').style.transform = `scaleY(${v})`; });
  setIf('pct', Math.round(q * 100), (v) => { $('#polePct').textContent = String(v).padStart(3, '0') + ' %'; });
  setIf('stage', q >= 0.999 ? 4 : q > 0.72 ? 3 : q > 0.36 ? 2 : q > 0.12 ? 1 : 0, (v) => { $('#poleStage').textContent = STAGES[v]; });
  if (enter > 0.55) setIf('title', 1, () => $('#poleTitle').classList.add('in'));
  $$('#poleReveal span').forEach((sp, i) => { const v = Math.round(sstep(0.8 + i * 0.05, 0.9 + i * 0.05, q) * 100) / 100; setIf('r' + i, v, () => { sp.style.opacity = v; sp.style.transform = `translate3d(0,${(1 - v) * 30}px,0)`; }); });
  setIf('hint', Math.round(sstep(0.2, 0.4, q) * 100) / 100, (v) => { $('#dragHint').style.opacity = String(v); });
}
function bindPoleDrag() {
  const el = $('#poleDrag'); let down = false, lx = 0;
  el.addEventListener('pointerdown', (e) => { down = true; lx = e.clientX; stage?.setPoleDragging(true); });
  addEventListener('pointermove', (e) => { if (!down) return; stage?.poleDragBy(e.clientX - lx); lx = e.clientX; }, { passive: true });
  const up = () => { down = false; stage?.setPoleDragging(false); }; addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

// ---------------- rendering from config ----------------
function cfg() { return store ? store.config : merge(null); }
function onConfig() { renderAll(cfg()); renderBooking(); }
function onSlots() { if (B.svc && B.date) { renderCalendar(); renderSlots(); } else if (B.svc) renderCalendar(); admin.refresh(); }
function onMedia() { renderGallery(cfg()); renderMasters(cfg()); admin.refresh(); }
function onMode() {
  if (!store) return; const t = $('#modeTag');
  const map = { live: ['live', 'Agenda online · horários em tempo real'], demo: ['demo', 'Modo demonstração · reservas salvas só neste navegador'], readonly: ['', 'Agenda em leitura · solicite pelo WhatsApp'], connecting: ['', 'Conectando agenda…'] };
  const [cls, txt] = map[store.mode] || map.connecting; t.className = 'mode-tag ' + cls; $('span', t).textContent = store.note || txt;
}
function renderAll(c) {
  $$('[data-biz=name]').forEach((e) => e.textContent = c.business.name || 'The Barber');
  document.title = `${c.business.name || 'The Barber'} — Experience`;
  renderServices(c); renderMasters(c); renderGallery(c); renderFooter(c);
}
function priceLabel(s) { return money(s.price) || 'Sob consulta'; }
function renderServices(c) {
  const all = activeServices(c);
  const groups = [['corte', 'Tesoura', 'Corte'], ['barba', 'Navalha', 'Barba']];
  let n = 0;
  $('#svcList').innerHTML = groups.map(([kind, tool, label]) => {
    const list = all.filter((s) => (s.kind === 'barba' ? 'barba' : 'corte') === kind); if (!list.length) return '';
    return `<div class="svc-group"><span class="g-tool">${tool}</span><span class="g-rule"></span><span class="g-lab">${label} · ${String(list.length).padStart(2, '0')}</span></div>` + list.map((s) => `
    <div class="svc" data-id="${esc(s.id)}" data-kind="${esc(kind)}" data-cursor="Explorar" tabindex="0">
      <span class="bar"></span><span class="n">${String(++n).padStart(2, '0')}</span>
      <h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p>
      <div class="price">${s.duration ? `${s.duration} min` : ''}<b>${esc(priceLabel(s))}</b></div>
      <a href="#agendar" class="btn sm ghost go" data-book="${esc(s.id)}"><span class="t">Agendar serviço</span><span class="ar"></span></a>
    </div>`).join('');
  }).join('');
  bindServiceHover();
  $('#fSvc').innerHTML = all.map((s) => `<li><a href="#agendar" data-book="${esc(s.id)}">${esc(s.name)}</a></li>`).join('');
}
function placeSvcAnchor(row) {
  const a = $('#svcAnchor'); const r = row.getBoundingClientRect(); const mob = innerWidth <= 860;
  const size = mob ? 150 : Math.min(320, r.height * 2.2);
  let x; if (mob) x = r.right - size * 0.45; else { const p = $('p', row).getBoundingClientRect(); x = p.left - 30; }
  a.style.width = size + 'px'; a.style.height = size + 'px';
  a.style.transform = `translate3d(${x - size / 2}px,${r.top + r.height / 2 - size / 2}px,0)`;
}
let svcRow = null;
function bindServiceHover() {
  const set = (row) => { svcRow = row; $$('.svc').forEach((r) => r.classList.toggle('on', r === row)); if (row) placeSvcAnchor(row); stage?.setService(row ? row.dataset.kind : null, row); };
  $$('.svc').forEach((row) => {
    row.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') set(row); });
    row.addEventListener('click', (e) => { if (e.target.closest('[data-book]')) return; set(svcRow === row && touch ? null : row); });
    row.addEventListener('focus', () => set(row));
  });
  $('#svcList').addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') set(null); });
  if (!bindServiceHover.bound) { bindServiceHover.bound = true; addEventListener('scroll', () => { if (svcRow) placeSvcAnchor(svcRow); }, { passive: true }); addEventListener('resize', () => { if (svcRow) placeSvcAnchor(svcRow); }); }
}
function renderMasters(c) {
  const media = store?.media || {}; const list = (c.barbers || []).filter((b) => b.active !== false);
  const ph = !list.length;
  const items = ph ? [1, 2, 3].map((n) => ({ id: null, name: `Profissional ${String(n).padStart(2, '0')}`, specialty: 'Especialidade', bio: 'Nome, retrato e especialidade reais entram pelo painel do estabelecimento.' })) : list;
  $('#masters').innerHTML = items.map((b) => {
    const img = b.id && media['barber_' + b.id];
    return `<article class="mst" ${b.id ? `data-barber="${esc(b.id)}" data-cursor="Agendar"` : ''}>
      <div class="pic">${img ? `<div class="im" style="background-image:url('${img}')"></div>` : `<div class="im ill" style="background-image:url('img/pro${(items.indexOf(b) % 3) + 1}.jpg')"></div>${ph ? '<span class="ph-tag">Imagem ilustrativa</span>' : `<div class="mono">${esc((b.name || '?').trim()[0] || '?')}</div>`}`}</div>
      <div class="info"><h3>${esc(b.name)}</h3><span class="sp">${esc(b.specialty || '')}</span><p>${esc(b.bio || '')}</p>
      ${b.id ? `<span class="bk-me">Agendar com ${esc(b.name.split(' ')[0])} <span class="ar" style="display:inline-block;width:18px;height:1px;background:currentColor"></span></span>` : ''}</div></article>`;
  }).join('');
  $('#mNote').textContent = ph ? 'Exemplo de composição. Os profissionais reais aparecem aqui assim que forem cadastrados.' : '';
}
function renderGallery(c) {
  const media = store?.media || {}; const caps = c.gallery || DEFAULT_CONFIG.gallery; const cls = ['a', 'b', 'c', 'd', 'e'];
  $('#gal').innerHTML = cls.map((k, i) => { const img = media['gal' + i];
    return `<figure class="ph ${k}"><div class="im" style="background-image:url('${img || `img/gal${i}.jpg`}')"></div><figcaption>${String(i + 1).padStart(2, '0')} — ${esc(caps[i] || '')}</figcaption>${img ? '' : '<span class="ph-tag">Imagem ilustrativa</span>'}</figure>`; }).join('');
  bindReveals.watch && bindReveals.watch();
}
function renderFooter(c) {
  const b = c.business; const rows = [];
  if (b.address) rows.push(`<li>${esc(b.address)}${b.city ? `<br><span class="muted">${esc(b.city)}</span>` : ''}</li>`);
  const hrs = b.hoursText || (c.configured ? hoursSummary(c) : '');
  if (hrs) rows.push(`<li class="muted" style="white-space:pre-line">${esc(hrs)}</li>`);
  if (b.whatsapp) rows.push(`<li><a href="https://wa.me/${esc(b.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp · ${esc(fmtPhone(b.whatsapp.replace(/\D/g, '').replace(/^55/, '')))}</a></li>`);
  if (b.instagram) rows.push(`<li><a href="https://instagram.com/${esc(b.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">Instagram · @${esc(b.instagram.replace(/^@/, ''))}</a></li>`);
  if (b.maps) rows.push(`<li><a href="${esc(b.maps)}" target="_blank" rel="noopener">Como chegar ↗</a></li>`);
  if (!rows.length) rows.push('<li class="muted">Endereço, horários e contatos são publicados pelo painel.</li>');
  $('#fInfo').innerHTML = rows.join('');
}
function hoursSummary(c) { const out = []; for (let d = 1; d <= 7; d++) { const w = d % 7, h = c.hours[w]; out.push(`${WD[w].slice(0, 3)} ${h ? `${h.o}–${h.c}` : 'fechado'}`); } return out.join('\n'); }

// ---------------- booking ----------------
function bindBooking() {
  document.addEventListener('click', (e) => {
    const bk = e.target.closest('[data-book]'); if (bk) { e.preventDefault(); selectService(bk.dataset.book); goTo('agendar'); return; }
    const m = e.target.closest('.mst[data-barber]'); if (m) { selectBarber(m.dataset.barber, true); goTo('agendar'); }
  });
  $('#bk').addEventListener('click', (e) => {
    const sh = e.target.closest('.step .sh'); if (sh) { const st = sh.parentElement; if (!st.classList.contains('locked')) openStep(+st.dataset.step); return; }
    const o = e.target.closest('[data-svc]'); if (o) return selectService(o.dataset.svc);
    const b = e.target.closest('[data-bar]'); if (b) return selectBarber(b.dataset.bar);
    const d = e.target.closest('[data-day]'); if (d && !d.disabled) return selectDate(d.dataset.day);
    const mv = e.target.closest('[data-mon]'); if (mv) { B.month = new Date(B.month.getFullYear(), B.month.getMonth() + +mv.dataset.mon, 1); return renderCalendar(); }
    const t = e.target.closest('[data-t]'); if (t) return selectTime(+t.dataset.t, t.dataset.b.split(','));
  });
  const fN = $('#fName'), fP = $('#fPhone');
  fP.addEventListener('input', () => { const pos = fP.value.length; fP.value = fmtPhone(fP.value); validate(false); });
  fN.addEventListener('input', () => validate(false));
  $('#form').addEventListener('submit', (e) => { e.preventDefault(); confirmBooking(); });
  $('#btnConfirm').addEventListener('click', confirmBooking);
  $('#btnNew').addEventListener('click', () => { resetBooking(); goTo('agendar'); });
  $('#btnCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(waText(B.last)); $('#btnCopy .t').textContent = 'Copiado'; setTimeout(() => $('#btnCopy .t').textContent = 'Copiar resumo', 1800); } catch (e) { $('#waNote').textContent = 'Não foi possível copiar automaticamente. Selecione o resumo acima.'; } });
}
function barberList() { return activeBarbers(cfg()); }
function openStep(n) { B.step = n; $$('.step').forEach((s) => s.classList.toggle('open', +s.dataset.step === n)); }
function stepVal(n, v) { const s = $(`.step[data-step="${n}"]`); $('[data-v]', s).textContent = v || ''; s.classList.toggle('done', !!v); }
function unlock(n) { $$('.step').forEach((s) => { const k = +s.dataset.step; s.classList.toggle('locked', k > n); }); }
function renderBooking() {
  const c = cfg(); const svcs = activeServices(c);
  if (B.svc && !svcs.find((s) => s.id === B.svc)) B.svc = null;
  $('#optSvc').innerHTML = svcs.map((s) => `<button class="opt ${B.svc === s.id ? 'sel' : ''}" data-svc="${esc(s.id)}"><span><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></span><span class="r">${s.duration} min<b>${esc(priceLabel(s))}</b></span></button>`).join('');
  const bars = barberList(); const multi = bars.length > 1;
  $('#stepBarber').classList.toggle('hidden', !multi);
  if (!multi) B.barber = bars[0].id;
  $('#optBarber').innerHTML = (multi ? [{ id: 'any', name: 'Sem preferência', specialty: 'Primeiro profissional disponível' }, ...bars] : bars).map((b) => `<button class="opt ${B.barber === b.id ? 'sel' : ''}" data-bar="${esc(b.id)}"><span><b>${esc(b.name)}</b><small>${esc(b.specialty || '')}</small></span><span class="r"></span></button>`).join('');
  if (B.svc) renderCalendar();
}
function selectService(id) {
  const s = activeServices(cfg()).find((x) => x.id === id); if (!s) return;
  B.svc = id; B.time = null; stepVal(1, s.name); stepVal(4, ''); renderBooking(); stage?.chairEvent('service'); $('#chairState').textContent = s.name.toLowerCase();
  const multi = barberList().length > 1;
  if (multi && !B.barber) { unlock(2); openStep(2); } else { if (!multi) B.barber = barberList()[0].id; unlock(3); openStep(3); B.month = B.month || firstOpenMonth(); renderCalendar(); }
  validate(false);
}
function selectBarber(id, fromMasters) {
  const bars = barberList(); const b = id === 'any' ? { name: 'Sem preferência' } : bars.find((x) => x.id === id); if (!b) return;
  B.barber = id; B.time = null; stepVal(2, b.name); stepVal(4, ''); renderBooking(); stage?.chairEvent('barber'); $('#chairState').textContent = 'com ' + b.name.toLowerCase();
  if (!B.svc) { unlock(1); openStep(1); return; }
  unlock(3); openStep(3); B.month = B.month || firstOpenMonth(); renderCalendar(); validate(false);
}
function selectDate(k) { B.date = k; B.time = null; stepVal(3, fmtDate(k)); stepVal(4, ''); renderCalendar(); renderSlots(); unlock(4); openStep(4); stage?.chairEvent('date'); $('#chairState').textContent = fmtDate(k).split(',')[0].toLowerCase(); validate(false); }
function selectTime(start, barbers) {
  B.time = { start, barbers }; stepVal(4, fmtMin(start)); renderSlots(); unlock(5); openStep(5); stage?.chairEvent('time'); $('#chairState').textContent = 'ajustada para ' + fmtMin(start);
  setTimeout(() => { if (!touch) $('#fName').focus({ preventScroll: true }); }, 500); validate(false);
}
function firstOpenMonth() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }
function svcObj() { return activeServices(cfg()).find((s) => s.id === B.svc); }
function renderCalendar() {
  const c = cfg(); const s = svcObj(); if (!s) return; if (!B.month) B.month = firstOpenMonth();
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last = new Date(today); last.setDate(last.getDate() + (+c.horizon || 45));
  const y = B.month.getFullYear(), m = B.month.getMonth(); const first = new Date(y, m, 1); const days = new Date(y, m + 1, 0).getDate();
  const slots = store ? store.slots : [];
  let html = `<div class="ch"><button data-mon="-1" ${y === today.getFullYear() && m === today.getMonth() ? 'disabled' : ''} aria-label="Mês anterior">‹</button><b>${MONTHS[m]} ${y}</b><button data-mon="1" ${new Date(y, m + 1, 1) > last ? 'disabled' : ''} aria-label="Próximo mês">›</button></div><div class="g">`;
  html += WDs.map((d) => `<span class="dw">${d}</span>`).join('');
  for (let i = 0; i < first.getDay(); i++) html += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const dt = new Date(y, m, d); const k = dayKey(dt);
    const ok = dt >= today && dt <= last && availability(c, slots, s, B.barber || 'any', dt).size > 0;
    html += `<button data-day="${k}" class="${k === dayKey(today) ? 'today' : ''} ${B.date === k ? 'sel' : ''}" ${ok ? '' : 'disabled'} aria-label="${fmtDate(k)}${ok ? '' : ' — indisponível'}">${d}</button>`;
  }
  $('#cal').innerHTML = html + '</div>';
}
function renderSlots() {
  const s = svcObj(); if (!s || !B.date) return; const av = availability(cfg(), store ? store.slots : [], s, B.barber || 'any', parseKey(B.date));
  if (B.time && !av.has(B.time.start)) { B.time = null; stepVal(4, ''); }
  if (!av.size) { $('#slots').innerHTML = '<p class="empty">Sem horários livres nesta data. Escolha outro dia.</p>'; return; }
  const groups = [['Manhã', 0, 720], ['Tarde', 720, 1080], ['Noite', 1080, 1440]]; let html = '';
  for (const [g, a, b] of groups) { const ts = [...av.entries()].filter(([t]) => t >= a && t < b); if (!ts.length) continue;
    html += `<span class="grp">${g}</span>` + ts.map(([t, bs]) => `<button data-t="${t}" data-b="${bs.join(',')}" class="${B.time?.start === t ? 'sel' : ''}">${fmtMin(t)}</button>`).join(''); }
  $('#slots').innerHTML = html;
}
function validate(show) {
  const n = $('#fName').value.trim(), p = $('#fPhone').value.replace(/\D/g, '');
  const okN = n.length >= 3, okP = p.length >= 10 && p.length <= 11;
  if (show) { $('#eName').textContent = okN ? '' : 'Informe seu nome.'; $('#ePhone').textContent = okP ? '' : 'Telefone com DDD, apenas números.'; }
  else { if (okN) $('#eName').textContent = ''; if (okP) $('#ePhone').textContent = ''; }
  stepVal(5, okN && okP ? n.split(' ')[0] : '');
  const ready = !!(B.svc && B.barber && B.date && B.time && okN && okP);
  $('#btnConfirm').disabled = !ready || B.busy; return ready;
}
async function confirmBooking() {
  if (!validate(true) || B.busy || !store) return;
  B.busy = true; const btn = $('#btnConfirm'); btn.disabled = true; $('.t', btn).textContent = 'Confirmando'; $('.ar', btn).outerHTML = '<span class="spin"></span>'; $('#bkMsg').textContent = '';
  const s = svcObj(); const r = await store.book({ service: s, barberIds: B.time.barbers, date: B.date, start: B.time.start, name: $('#fName').value, phone: $('#fPhone').value });
  B.busy = false; $('.t', btn).textContent = 'Confirmar agendamento'; const sp = $('.spin', btn); if (sp) sp.outerHTML = '<span class="ar"></span>';
  if (!r.ok) { $('#bkMsg').textContent = r.error; if (r.taken) { B.time = null; stepVal(4, ''); renderSlots(); openStep(4); } if (store.mode === 'readonly') showWaRequest(); validate(false); return; }
  B.last = Object.assign({ serviceName: s.name, price: s.price }, r.booking);
  showConfirmation(B.last); stage?.chairEvent('confirm'); $('#chairState').textContent = 'reservada';
}
function waText(b) {
  const biz = cfg().business.name || 'The Barber';
  return `Olá! Acabei de agendar na ${biz}.\n\n• Serviço: ${b.serviceName}\n• Profissional: ${b.barberName}\n• Data: ${fmtDate(b.date)}\n• Horário: ${fmtMin(b.start)}\n• Nome: ${b.name}\n• Telefone: ${fmtPhone(b.phone)}\n\nCódigo da reserva: ${b.id}`;
}
function waLink(text) { const n = (cfg().business.whatsapp || '').replace(/\D/g, ''); return `https://wa.me/${n}?text=${encodeURIComponent(text)}`; }
function showConfirmation(b) {
  $('#bk').classList.add('hidden'); const c = $('#confirm'); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  $('#cCode').textContent = 'Código ' + b.id;
  const rows = [['Serviço', b.serviceName], ['Profissional', b.barberName], ['Data', fmtDate(b.date)], ['Horário', `${fmtMin(b.start)} – ${fmtMin(b.end)}`], ['Nome', b.name], ['Telefone', fmtPhone(b.phone)]];
  if (money(b.price)) rows.push(['Valor', money(b.price)]);
  $('#ticket').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('');
  $('#btnWa').href = waLink(waText(b));
  $('#waNote').textContent = (cfg().business.whatsapp ? 'O WhatsApp abre com a mensagem pronta para a barbearia.' : 'O WhatsApp abre com a mensagem pronta; escolha o contato da barbearia.') + (store.mode === 'demo' ? ' Esta reserva foi registrada em modo demonstração, apenas neste navegador.' : ' Sua reserva já está registrada na agenda.');
  c.scrollIntoView({ block: 'nearest' });
}
function showWaRequest() {
  const s = svcObj(); const bars = barberList(); const b = bars.find((x) => x.id === B.time?.barbers[0]) || { name: 'Sem preferência' };
  const t = `Olá! Gostaria de solicitar um horário:\n\n• Serviço: ${s.name}\n• Profissional: ${b.name}\n• Data: ${fmtDate(B.date)}\n• Horário: ${fmtMin(B.time.start)}\n• Nome: ${$('#fName').value.trim()}`;
  $('#bkMsg').innerHTML = `${esc($('#bkMsg').textContent)} <a href="${waLink(t)}" target="_blank" rel="noopener" style="color:var(--ivory);border-bottom:1px solid var(--copper)">Solicitar pelo WhatsApp ↗</a>`;
}
function resetBooking() {
  Object.assign(B, { svc: null, barber: barberList().length > 1 ? null : B.barber, date: null, time: null, last: null });
  $('#confirm').classList.remove('show'); $('#bk').classList.remove('hidden'); [1, 2, 3, 4, 5].forEach((n) => stepVal(n, '')); $('#form').reset(); $('#cal').innerHTML = ''; $('#slots').innerHTML = '';
  unlock(1); openStep(1); renderBooking(); validate(false); stage?.chairEvent('reset'); $('#chairState').textContent = 'em repouso';
}

// ---------------- admin ----------------
let admin = { refresh() {}, open() {} };
import('./admin.js').then(({ createAdmin }) => {
  admin = createAdmin({ store: () => store, cfg: () => cfg(), onOpen: () => lenis?.stop(), onClose: () => lenis?.start() });
  if (location.hash === '#admin') admin.open();
});
addEventListener('hashchange', () => { if (location.hash === '#admin') admin.open(); });
document.addEventListener('click', (e) => { const a = e.target.closest('[data-admin]'); if (a) { e.preventDefault(); admin.open(); } });

boot();
