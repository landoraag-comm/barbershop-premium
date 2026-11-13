// ===== Data layer: config, availability engine, booking store =====
export const DEFAULT_CONFIG = {
  v: 2, configured: false,
  business: { name: 'The Barber', tagline: 'Experience', address: '', city: '', whatsapp: '', instagram: '', maps: '', hoursText: '' },
  services: [
    { id: 'corte', name: 'Corte Masculino', desc: 'Técnica, personalidade e acabamento impecável.', kind: 'corte', duration: 45, price: null, active: true },
    { id: 'fade', name: 'Degradê & Fade', desc: 'Transições precisas, do zero à tesoura, sob medida para o seu rosto.', kind: 'corte', duration: 50, price: null, active: true },
    { id: 'combo', name: 'Corte + Barba', desc: 'Uma experiência completa de cuidado masculino.', kind: 'corte', duration: 80, price: null, active: true },
    { id: 'barba', name: 'Barba Clássica', desc: 'O ritual tradicional de toalha quente, navalha e precisão.', kind: 'barba', duration: 40, price: null, active: true },
    { id: 'terapia', name: 'Barboterapia', desc: 'Toalha quente, óleos e massagem facial antes do desenho da navalha.', kind: 'barba', duration: 50, price: null, active: true },
    { id: 'acab', name: 'Acabamento e Contornos', desc: 'Detalhes que transformam a aparência.', kind: 'barba', duration: 20, price: null, active: true },
  ],
  barbers: [],
  hours: { 0: null, 1: null, 2: { o: '09:00', c: '19:00' }, 3: { o: '09:00', c: '19:00' }, 4: { o: '09:00', c: '19:00' }, 5: { o: '09:00', c: '19:00' }, 6: { o: '09:00', c: '17:00' } },
  breaks: [{ s: '12:00', e: '13:00' }],
  step: 15, buffer: 0, lead: 60, horizon: 45,
  blocks: [],
  gallery: ['O espaço', 'As cadeiras', 'Tradição', 'Precisão', 'O ritual'],
};
export const HOUSE = { id: 'casa', name: 'Equipe da casa', specialty: 'Qualquer profissional disponível', bio: '', days: [0, 1, 2, 3, 4, 5, 6], active: true, virtual: true };

export const toMin = (s) => { if (!s) return null; const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
export const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const money = (v) => (v == null || v === '' || isNaN(+v)) ? null : (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const uidShort = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export function merge(cfg) {
  const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  if (!cfg) return c;
  for (const k of Object.keys(cfg)) if (cfg[k] !== undefined) c[k] = cfg[k];
  c.business = Object.assign({}, DEFAULT_CONFIG.business, cfg.business || {});
  if (JSON.stringify(c.gallery) === JSON.stringify(['A cadeira', 'O poste', 'Ferramentas', 'Navalha e couro', 'Couro e cromo'])) c.gallery = DEFAULT_CONFIG.gallery.slice();
  // v1 -> v2: the catalogue grew to 3 scissor + 3 razor services; add the new defaults if missing
  if ((cfg.v || 1) < 2 && Array.isArray(c.services)) { const ids = new Set(c.services.map((x) => x.id));
    for (const sv of DEFAULT_CONFIG.services) if (!ids.has(sv.id)) c.services.push(JSON.parse(JSON.stringify(sv)));
    if (JSON.stringify(c.gallery) === JSON.stringify(['Visão do espaço', 'Estação de trabalho', 'Ferramentas', 'Profissional em atividade', 'Texturas e acabamentos'])) c.gallery = DEFAULT_CONFIG.gallery.slice(); c.v = 2; }
  return c;
}
export const activeBarbers = (cfg) => { const b = (cfg.barbers || []).filter((x) => x.active !== false); return b.length ? b : [HOUSE]; };
export const activeServices = (cfg) => (cfg.services || []).filter((s) => s.active !== false);

// working windows for a barber on a date (minutes), minus breaks & blocks
function windows(cfg, barber, date) {
  const key = dayKey(date), wd = date.getDay();
  const h = cfg.hours?.[wd]; if (!h || !h.o || !h.c) return [];
  if (barber.days && !barber.days.includes(wd)) return [];
  let win = [[toMin(h.o), toMin(h.c)]];
  const cut = (s, e) => { const out = []; for (const [a, b] of win) { if (e <= a || s >= b) out.push([a, b]); else { if (s > a) out.push([a, s]); if (e < b) out.push([e, b]); } } win = out; };
  for (const br of cfg.breaks || []) if (br.s && br.e) cut(toMin(br.s), toMin(br.e));
  for (const bl of cfg.blocks || []) {
    if (bl.date !== key) continue; if (bl.barberId && bl.barberId !== 'all' && bl.barberId !== barber.id) continue;
    if (bl.s && bl.e) cut(toMin(bl.s), toMin(bl.e)); else win = [];
  }
  return win;
}

// slots: flattened [{barberId,date,start,end,status}]
export function freeStarts(cfg, slots, service, barber, date, now = new Date()) {
  const dur = +service.duration || 30, step = +cfg.step || 15, buf = +cfg.buffer || 0;
  const key = dayKey(date);
  const busy = slots.filter((s) => s.status !== 'cancelled' && s.date === key && (s.barberId === barber.id)).map((s) => [s.start, s.end + buf]);
  const isToday = dayKey(now) === key; const minStart = isToday ? now.getHours() * 60 + now.getMinutes() + (+cfg.lead || 0) : -1;
  if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return [];
  const out = [];
  for (const [a, b] of windows(cfg, barber, date)) {
    const first = Math.ceil(a / step) * step;
    for (let t = first; t + dur <= b; t += step) {
      if (t < minStart) continue;
      const e = t + dur + buf;
      if (busy.some(([s, en]) => t < en && e > s)) continue;
      out.push(t);
    }
  }
  return out;
}
// availability across one or all barbers -> Map start -> [barberIds]
export function availability(cfg, slots, service, barberId, date) {
  const list = barberId === 'any' ? activeBarbers(cfg) : activeBarbers(cfg).filter((b) => b.id === barberId);
  const map = new Map();
  for (const b of list) for (const t of freeStarts(cfg, slots, service, b, date)) { if (!map.has(t)) map.set(t, []); map.get(t).push(b.id); }
  return new Map([...map.entries()].sort((x, y) => x[0] - y[0]));
}
export function conflicts(cfg, slots, barberId, date, start, end) {
  const buf = +cfg.buffer || 0;
  return slots.some((s) => s.status !== 'cancelled' && s.barberId === barberId && s.date === date && start < s.end + buf && end + buf > s.start);
}

// ---------- Stores ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flatten = (docs) => { const out = []; for (const d of docs) for (const it of (d.items || [])) out.push(Object.assign({ uid: d.uid }, it)); return out; };
const pruneOld = (items) => { const lim = dayKey(new Date(Date.now() - 1000 * 60 * 60 * 24 * 60)); return items.filter((x) => x.date >= lim); };

const ON_FIREBASE = /(\.web\.app|\.firebaseapp\.com)$/.test(location.hostname) || !!window.__FIREBASE_CONFIG__;
export async function createStore(listeners) {
  if (ON_FIREBASE) { try { const m = await import('./firebase-store.js'); return await m.createFirebaseStore(listeners, { merge, freeStarts, conflicts, activeBarbers, parseKey, dayKey }); } catch (e) { console.error('Firebase indisponível', e); } }
  const emit = (k) => listeners[k] && listeners[k]();
  const S = { mode: 'connecting', config: merge(null), slots: [], media: {}, bookings: [], canEdit: false, uid: null, note: '' };
  let db = null, user = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    }
  } catch (e) { db = null; }

  if (db) {
    try { S.uid = user ? await user.id() : null; } catch (e) { S.uid = null; }
    let canWrite = null; try { canWrite = user ? await user.can('data.write') : null; } catch (e) {}
    try { S.canEdit = user ? !!(await user.canEdit()) : false; } catch (e) {}
    S.mode = S.uid && canWrite !== false ? 'live' : 'readonly';
    let gotCfg = false;
    const timer = setTimeout(() => { if (!gotCfg) { S.note = 'A agenda está demorando para responder.'; emit('mode'); } }, 10000);
    db.doc('config/main').onSnapshot((snap) => { gotCfg = true; clearTimeout(timer); S.config = merge(snap.exists ? snap.data() : null); emit('config'); }, () => { clearTimeout(timer); emit('config'); });
    db.collection('slots').onSnapshot((snap) => { S.slots = flatten(snap.docs.map((d) => Object.assign({ uid: d.id }, d.data()))); emit('slots'); }, () => {});
    db.collection('media').onSnapshot((snap) => { const m = {}; for (const d of snap.docs) m[d.id] = d.data().data; S.media = m; emit('media'); }, () => {});
    if (S.canEdit) db.collection('bookings').onSnapshot((snap) => { S.bookings = flatten(snap.docs.map((d) => Object.assign({ uid: d.id }, d.data()))); emit('bookings'); }, () => {});
  } else {
    // demo: this browser only
    S.mode = 'demo'; S.canEdit = location.hash === '#painel';
    const load = () => { try { return JSON.parse(localStorage.getItem('tbe-demo') || '{}'); } catch (e) { return {}; } };
    const L = load(); S.uid = 'demo';
    S.config = merge(L.config); S.slots = flatten([{ uid: 'demo', items: L.slots || [] }]); S.bookings = flatten([{ uid: 'demo', items: L.bookings || [] }]); S.media = L.media || {};
    S._save = () => { try { localStorage.setItem('tbe-demo', JSON.stringify({ config: S.config, slots: S.slots.map(({ uid, ...r }) => r), bookings: S.bookings.map(({ uid, ...r }) => r), media: S.media })); } catch (e) {} };
    setTimeout(() => { emit('config'); emit('slots'); emit('media'); emit('bookings'); }, 0);
  }

  // ----- booking -----
  S.book = async ({ service, barberIds, date, start, name, phone }) => {
    const end = start + (+service.duration || 30);
    const cfg = S.config; const all = activeBarbers(cfg);
    if (S.mode === 'readonly') return { ok: false, error: 'Seu acesso a esta página não permite reservas online. Use o WhatsApp para solicitar o horário.' };
    // re-validate inputs
    if (!name || name.trim().length < 3) return { ok: false, error: 'Informe seu nome.' };
    const digits = String(phone).replace(/\D/g, ''); if (digits.length < 10 || digits.length > 11) return { ok: false, error: 'Telefone inválido.' };
    for (const bid of barberIds) {
      const barber = all.find((b) => b.id === bid); if (!barber) continue;
      let lockOk = true, lockRef = null;
      if (db) {
        lockRef = db.doc(`locks/${bid}_${date}`); lockOk = false;
        for (let n = 0; n < 6 && !lockOk; n++) { try { const r = await lockRef.acquire({ holder: S.uid, ttlMs: 9000 }); lockOk = !!r.acquired; } catch (e) { lockOk = false; } if (!lockOk) await sleep(500 + Math.random() * 600); }
        if (!lockOk) continue;
      }
      // fresh view of the agenda
      let fresh = S.slots;
      if (db) { try { const snap = await db.collection('slots').get(); fresh = flatten(snap.docs.map((d) => Object.assign({ uid: d.id }, d.data()))); } catch (e) { return { ok: false, error: 'Não foi possível consultar a agenda. Tente novamente.' }; } }
      const okStart = freeStarts(cfg, fresh, service, barber, parseKey(date)).includes(start);
      if (!okStart || conflicts(cfg, fresh, bid, date, start, end)) continue;
      const id = uidShort() + uidShort().slice(0, 2);
      const slot = { id, barberId: bid, date, start, end, status: 'confirmed' };
      const bk = Object.assign({}, slot, { serviceId: service.id, serviceName: service.name, barberName: barber.name, name: name.trim().slice(0, 60), phone: digits, createdAt: new Date().toISOString() });
      try {
        if (db) {
          const sRef = db.doc(`slots/${S.uid}`); const sSnap = await sRef.get();
          await sRef.set({ items: pruneOld([...(sSnap.exists ? sSnap.data().items || [] : []), slot]) });
          const bRef = db.doc(`bookings/${S.uid}`); const bSnap = await bRef.get();
          await bRef.set({ items: pruneOld([...(bSnap.exists ? bSnap.data().items || [] : []), bk]) });
        } else { S.slots = [...S.slots, Object.assign({ uid: 'demo' }, slot)]; S.bookings = [...S.bookings, Object.assign({ uid: 'demo' }, bk)]; S._save(); emit('slots'); emit('bookings'); }
      } catch (e) {
        const q = e && e.code === 'quota_exceeded';
        return { ok: false, error: q ? 'A agenda online atingiu o limite de armazenamento. Fale com a barbearia pelo WhatsApp.' : 'Não foi possível registrar a reserva. Tente novamente.' };
      }
      return { ok: true, booking: bk };
    }
    return { ok: false, error: 'Esse horário acabou de ser reservado. Escolha outro, por favor.', taken: true };
  };

  // ----- admin -----
  S.saveConfig = async (cfg) => {
    cfg = JSON.parse(JSON.stringify(cfg)); cfg.configured = true;
    if (db) await db.doc('config/main').set(cfg); else { S.config = merge(cfg); S._save(); emit('config'); }
  };
  S.saveMedia = async (key, data) => {
    if (db) { if (data) await db.doc(`media/${key}`).set({ data }); else await db.doc(`media/${key}`).delete(); }
    else { if (data) S.media[key] = data; else delete S.media[key]; S._save(); emit('media'); }
  };
  S.cancel = async (uid, id) => {
    if (db) {
      for (const col of ['slots', 'bookings']) { const ref = db.doc(`${col}/${uid}`); const snap = await ref.get(); if (!snap.exists) continue;
        await ref.set({ items: (snap.data().items || []).map((x) => x.id === id ? Object.assign({}, x, { status: 'cancelled' }) : x) }); }
    } else {
      S.slots = S.slots.map((x) => x.id === id ? Object.assign({}, x, { status: 'cancelled' }) : x);
      S.bookings = S.bookings.map((x) => x.id === id ? Object.assign({}, x, { status: 'cancelled' }) : x); S._save(); emit('slots'); emit('bookings');
    }
  };
  S.getSecure = async () => { if (!db) return null; const snap = await db.doc('secure/admin').get(); return snap.exists ? snap.data() : null; };
  S.setSecure = async (c) => { if (!db) throw new Error('sem banco'); await db.doc('secure/admin').set(c); };
  emit('mode');
  return S;
}
