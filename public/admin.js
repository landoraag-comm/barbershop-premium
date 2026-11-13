// ===== Admin area: login + dashboard =====
import { DEFAULT_CONFIG, merge, activeBarbers, activeServices, availability, toMin, fmtMin, dayKey, parseKey, money } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtPhone = (d) => { d = String(d || '').replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
const fmtDay = (k) => { const d = parseKey(k); return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
const rid = () => Math.random().toString(36).slice(2, 9);

const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  scis: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.2 16 19 3M15.8 16 5 3"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M15.5 14.2c2.9.3 5.5 2.6 5.5 5.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  shop: '<path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  wa: '<path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

// ---------- crypto ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashPass(pass, saltB64, iter = 150000) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
  return { salt: b64(salt), hash: b64(bits), iter };
}

export function createAdmin(ctx) {
  // ctx: { store: () => store, cfg: () => config, onClose }
  let root = null, page = 'overview', draft = null, dirty = false, cred = undefined, day = dayKey(new Date()), filt = 'all', drawer = false, manual = null;
  const S = () => ctx.store();
  const SESSION = 'tbe-admin-session';

  // credentials live at secure/admin (readable/writable only by the page's editors); demo -> localStorage
  async function loadCred() {
    const s = S(); if (!s) return null;
    if (s.mode === 'demo') { try { return JSON.parse(localStorage.getItem('tbe-admin-cred') || 'null'); } catch (e) { return null; } }
    try { return await s.getSecure(); } catch (e) { return null; }
  }
  async function saveCred(c) {
    const s = S(); if (s.mode === 'demo') { localStorage.setItem('tbe-admin-cred', JSON.stringify(c)); return; }
    await s.setSecure(c);
  }
  const sessionOk = () => { try { const v = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); return v && v.exp > Date.now() && cred && v.h === cred.hash.slice(0, 12); } catch (e) { return false; } };
  const startSession = () => { try { sessionStorage.setItem(SESSION, JSON.stringify({ exp: Date.now() + 8 * 3600e3, h: cred.hash.slice(0, 12) })); } catch (e) {} };

  function mount() {
    if (root) return; root = document.createElement('div'); root.id = 'ax'; root.className = 'ax'; document.body.appendChild(root);
    root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput); root.addEventListener('submit', onSubmit);
  }
  async function open() {
    mount(); root.classList.add('show'); document.documentElement.classList.add('ax-open'); ctx.onOpen && ctx.onOpen();
    root.innerHTML = `<div class="ax-login"><div class="ax-spin"></div></div>`;
    for (let i = 0; i < 100 && !S(); i++) await new Promise((r) => setTimeout(r, 100));
    if (S()?.authMode === 'firebase') { await S().authReady(); if (S().canEdit) return app(); return loginFb(); }
    cred = await loadCred();
    if (cred && sessionOk()) return app();
    login();
  }
  function close() { if (!root) return; root.classList.remove('show'); document.documentElement.classList.remove('ax-open'); if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search); ctx.onClose && ctx.onClose(); }

  // ---------- login ----------
  function login(msg = '') {
    const s = S(); const canSetup = !cred && s && (s.mode === 'demo' || s.canEdit);
    const name = ctx.cfg().business.name || 'The Barber';
    root.innerHTML = `<div class="ax-login">
      <button class="ax-back" data-act="close">${ic('x')}<span>Voltar ao site</span></button>
      <form class="ax-card" data-form="${canSetup ? 'setup' : 'login'}" autocomplete="on">
        <div class="ax-mark">B</div>
        <p class="ax-kicker">${esc(name)} · Área administrativa</p>
        <h1>${canSetup ? 'Crie seu acesso' : 'Entrar'}</h1>
        <p class="ax-sub">${canSetup ? 'Primeiro acesso: defina o usuário e a senha que protegem o painel.' : 'Use seu usuário e senha de administrador.'}</p>
        <label class="ax-f"><span>Usuário</span><input name="user" autocomplete="username" required minlength="3" maxlength="40" value="${esc(cred?.user && false ? cred.user : '')}"></label>
        <label class="ax-f"><span>Senha</span><div class="ax-pw"><input name="pass" type="password" autocomplete="${canSetup ? 'new-password' : 'current-password'}" required minlength="${canSetup ? 8 : 1}"><button type="button" data-act="peek" aria-label="Mostrar senha">${ic('eye')}</button></div></label>
        ${canSetup ? `<label class="ax-f"><span>Confirmar senha</span><input name="pass2" type="password" autocomplete="new-password" required minlength="8"></label>` : ''}
        <p class="ax-err" role="alert">${esc(msg)}</p>
        <button class="ax-btn primary wide" type="submit">${canSetup ? 'Criar acesso e entrar' : 'Entrar'}</button>
        <p class="ax-foot">${s && s.mode === 'demo' ? 'Modo demonstração: o acesso fica salvo apenas neste navegador.' : 'Acesso restrito à equipe da barbearia.'}</p>
      </form></div>`;
    setTimeout(() => $('input[name=user]', root)?.focus(), 60);
  }
  async function loginFb(msg = '') {
    const s = S(); const setup = !(await s.ownerExists()); const name = ctx.cfg().business.name || 'The Barber';
    root.innerHTML = `<div class="ax-login">
      <button class="ax-back" data-act="close">${ic('x')}<span>Voltar ao site</span></button>
      <form class="ax-card" data-form="${setup ? 'fbsetup' : 'fblogin'}" autocomplete="on">
        <div class="ax-mark">B</div>
        <p class="ax-kicker">${esc(name)} · Área administrativa</p>
        <h1>${setup ? 'Crie seu acesso' : 'Entrar'}</h1>
        <p class="ax-sub">${setup ? 'Primeiro acesso: este e-mail será o responsável pelo painel. Faça isso logo após publicar o site.' : 'Use o e-mail e a senha de administrador.'}</p>
        <label class="ax-f"><span>E-mail</span><input name="user" type="email" autocomplete="username" required></label>
        <label class="ax-f"><span>Senha</span><div class="ax-pw"><input name="pass" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? 8 : 1}"><button type="button" data-act="peek" aria-label="Mostrar senha">${ic('eye')}</button></div></label>
        ${setup ? `<label class="ax-f"><span>Confirmar senha</span><input name="pass2" type="password" autocomplete="new-password" required minlength="8"></label>` : ''}
        <p class="ax-err" role="alert">${esc(msg)}</p>
        <button class="ax-btn primary wide" type="submit">${setup ? 'Criar acesso e entrar' : 'Entrar'}</button>
        ${setup ? '' : '<p class="ax-foot"><button type="button" class="ax-link" data-act="reset">Esqueci minha senha</button></p>'}
        <p class="ax-foot">Login protegido pelo Firebase Authentication.</p>
      </form></div>`;
    setTimeout(() => $('input[name=user]', root)?.focus(), 60);
  }
  async function doLoginFb(f) {
    const err = $('.ax-err', root), btn = $('button[type=submit]', root); err.textContent = ''; btn.disabled = true; const lbl = btn.textContent; btn.textContent = 'Verificando…';
    const email = f.user.value.trim(), pass = f.pass.value; let r;
    if (f.dataset.form === 'fbsetup') { if (pass.length < 8) r = { ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' }; else if (pass !== f.pass2.value) r = { ok: false, error: 'As senhas não conferem.' }; else r = await S().setupOwner(email, pass); }
    else r = await S().signIn(email, pass);
    if (r.ok) return app();
    err.textContent = r.error; btn.disabled = false; btn.textContent = lbl;
  }
  async function doLogin(f) {
    const err = $('.ax-err', root), btn = $('button[type=submit]', root); err.textContent = ''; btn.disabled = true; btn.textContent = 'Verificando…';
    const user = f.user.value.trim().toLowerCase(), pass = f.pass.value;
    try {
      if (f.dataset.form === 'setup') {
        if (pass.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        if (pass !== f.pass2.value) throw new Error('As senhas não conferem.');
        const h = await hashPass(pass); cred = { user, ...h, createdAt: new Date().toISOString() }; await saveCred(cred); startSession(); return app();
      }
      if (!cred) cred = await loadCred();
      await new Promise((r) => setTimeout(r, 450)); // slows down guessing
      if (!cred) throw new Error('Usuário ou senha inválidos.');
      const h = await hashPass(pass, cred.salt, cred.iter);
      if (user !== cred.user || h.hash !== cred.hash) throw new Error('Usuário ou senha inválidos.');
      startSession(); app();
    } catch (e) { err.textContent = e.message || 'Não foi possível entrar.'; btn.disabled = false; btn.textContent = f.dataset.form === 'setup' ? 'Criar acesso e entrar' : 'Entrar'; }
  }

  // ---------- app shell ----------
  const NAV = [['overview', 'Visão geral', 'home'], ['agenda', 'Agenda', 'cal'], ['servicos', 'Serviços', 'scis'], ['equipe', 'Profissionais', 'team'], ['horarios', 'Horários', 'clock'], ['bloqueios', 'Bloqueios', 'block'], ['casa', 'Estabelecimento', 'shop']];
  const EDIT = ['servicos', 'equipe', 'horarios', 'bloqueios', 'casa'];
  function app() {
    draft = JSON.parse(JSON.stringify(ctx.cfg())); dirty = false; render();
  }
  function render() {
    if (!root || !root.classList.contains('show') || !draft) return;
    const s = S(); const name = draft.business.name || 'The Barber'; const title = NAV.find((n) => n[0] === page);
    const scrollY = $('.ax-main', root)?.scrollTop || 0;
    root.innerHTML = `<div class="ax-app ${drawer ? 'drawer' : ''}">
      <aside class="ax-side">
        <div class="ax-brand"><span class="ax-mark sm">B</span><div><b>${esc(name)}</b><small>Painel</small></div><button class="ax-x" data-act="drawer">${ic('x')}</button></div>
        <nav>${NAV.map(([k, l, i]) => `<button data-page="${k}" class="${page === k ? 'on' : ''}">${ic(i)}<span>${l}</span>${k === 'agenda' ? `<em>${todayCount() || ''}</em>` : ''}</button>`).join('')}</nav>
        <div class="ax-side-foot">
          <span class="ax-mode ${s?.mode}">${s?.mode === 'live' ? 'Agenda online' : s?.mode === 'demo' ? 'Demonstração' : 'Somente leitura'}</span>
          <button data-act="close">${ic('ext')}<span>Ver o site</span></button>
          <button data-act="logout">${ic('out')}<span>Sair</span></button>
        </div>
      </aside>
      <div class="ax-scrim" data-act="drawer"></div>
      <main class="ax-main">
        <header class="ax-top"><button class="ax-burger" data-act="drawer">${ic('menu')}</button><div><p class="ax-kicker">${esc(name)}</p><h1>${title[1]}</h1></div>
          <div class="ax-top-r">${EDIT.includes(page) ? `<span class="ax-status" id="axStatus">${dirty ? 'Alterações não salvas' : ''}</span><button class="ax-btn primary" data-act="save" ${dirty ? '' : 'disabled'}>Salvar alterações</button>` : ''}</div></header>
        <section class="ax-body">${body()}</section>
      </main></div>`;
    const m = $('.ax-main', root); if (m) m.scrollTop = scrollY;
  }
  const bookings = () => (S()?.bookings || []);
  const todayCount = () => bookings().filter((b) => b.date === dayKey(new Date()) && b.status !== 'cancelled').length;
  const barberName = (id) => (activeBarbers(draft).find((b) => b.id === id) || {}).name || id;

  function body() {
    const d = draft;
    if (page === 'overview') {
      const today = dayKey(new Date()); const in7 = dayKey(new Date(Date.now() + 7 * 864e5)); const ago30 = dayKey(new Date(Date.now() - 30 * 864e5));
      const live = bookings().filter((b) => b.status !== 'cancelled');
      const tdy = live.filter((b) => b.date === today), wk = live.filter((b) => b.date >= today && b.date <= in7);
      const cx = bookings().filter((b) => b.status === 'cancelled' && b.date >= ago30).length;
      // occupancy today = booked minutes / open minutes across professionals
      let open = 0; const wd = new Date().getDay(); const h = d.hours[wd];
      if (h) for (const b of activeBarbers(d)) if (!b.days || b.days.includes(wd)) { open += toMin(h.c) - toMin(h.o); for (const br of d.breaks || []) open -= Math.max(0, toMin(br.e) - toMin(br.s)); }
      const booked = tdy.reduce((a, b) => a + (b.end - b.start), 0); const occ = open > 0 ? Math.round(booked / open * 100) : 0;
      const next = live.filter((b) => b.date > today || (b.date === today && b.end >= new Date().getHours() * 60 + new Date().getMinutes())).sort((a, b) => (a.date + fmtMin(a.start)).localeCompare(b.date + fmtMin(b.start))).slice(0, 6);
      const svcCount = {}; for (const b of live.filter((x) => x.date >= ago30)) svcCount[b.serviceName] = (svcCount[b.serviceName] || 0) + 1;
      const top = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 4); const topMax = top[0]?.[1] || 1;
      return `${!d.configured ? `<div class="ax-banner"><b>Configure a barbearia</b><span>Cadastre serviços, preços, profissionais e horários reais. Até lá o site mostra valores “Sob consulta”.</span><button class="ax-btn" data-page="casa">Começar</button></div>` : ''}
        <div class="ax-kpis">
          <div class="ax-kpi"><span>Hoje</span><b>${tdy.length}</b><small>reservas confirmadas</small></div>
          <div class="ax-kpi"><span>Próximos 7 dias</span><b>${wk.length}</b><small>reservas</small></div>
          <div class="ax-kpi"><span>Ocupação hoje</span><b>${occ}<i>%</i></b><div class="ax-meter"><i style="width:${Math.min(100, occ)}%"></i></div></div>
          <div class="ax-kpi"><span>Cancelamentos</span><b>${cx}</b><small>nos últimos 30 dias</small></div>
        </div>
        <div class="ax-grid2">
          <div class="ax-panel"><div class="ax-ph"><h2>Próximos atendimentos</h2><button class="ax-link" data-page="agenda">Ver agenda</button></div>
            ${next.length ? next.map(rowBooking).join('') : `<p class="ax-empty">Nenhum atendimento futuro.</p>`}</div>
          <div class="ax-panel"><div class="ax-ph"><h2>Serviços mais pedidos</h2><small>30 dias</small></div>
            ${top.length ? top.map(([n, c]) => `<div class="ax-bar"><span>${esc(n)}</span><div><i style="width:${c / topMax * 100}%"></i></div><b>${c}</b></div>`).join('') : `<p class="ax-empty">Os números aparecem com as primeiras reservas.</p>`}
            <div class="ax-ph" style="margin-top:26px"><h2>Atalhos</h2></div>
            <div class="ax-quick"><button data-act="manual">${ic('plus')}Nova reserva</button><button data-page="bloqueios">${ic('block')}Bloquear horário</button><button data-page="servicos">${ic('scis')}Editar preços</button></div>
          </div></div>`;
    }
    if (page === 'agenda') {
      const days = []; for (let i = -1; i < 20; i++) { const dt = new Date(); dt.setDate(dt.getDate() + i); days.push(dayKey(dt)); }
      const list = bookings().filter((b) => b.date === day && (filt === 'all' || b.barberId === filt)).sort((a, b) => a.start - b.start);
      const bars = activeBarbers(d);
      return `<div class="ax-days">${days.map((k) => { const dt = parseKey(k); const n = bookings().filter((b) => b.date === k && b.status !== 'cancelled').length;
          return `<button data-day="${k}" class="${k === day ? 'on' : ''} ${k === dayKey(new Date()) ? 'today' : ''}"><small>${WD[dt.getDay()].slice(0, 3)}</small><b>${dt.getDate()}</b><i>${n || ''}</i></button>`; }).join('')}</div>
        <div class="ax-toolbar"><div class="ax-chips">${[['all', 'Todos'], ...bars.map((b) => [b.id, b.name])].map(([k, l]) => `<button data-filt="${esc(k)}" class="${filt === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
          <button class="ax-btn primary" data-act="manual">${ic('plus')}Nova reserva</button></div>
        <div class="ax-panel"><div class="ax-ph"><h2>${fmtDay(day)}</h2><small>${list.filter((b) => b.status !== 'cancelled').length} confirmadas</small></div>
        ${list.length ? list.map(rowBooking).join('') : `<p class="ax-empty">Nenhuma reserva neste dia.</p>`}</div>
        ${manual ? manualForm() : ''}`;
    }
    if (page === 'servicos') {
      const card = (s, i) => `<div class="ax-item"><div class="ax-item-h"><span class="ax-tag ${s.kind === 'barba' ? 'nav' : 'tes'}">${s.kind === 'barba' ? 'Navalha' : 'Tesoura'}</span><label class="ax-switch"><input type="checkbox" data-f="services.${i}.active" ${s.active !== false ? 'checked' : ''}><i></i><span>${s.active !== false ? 'Ativo' : 'Oculto'}</span></label><button class="ax-icon" data-del="services.${i}" aria-label="Remover">${ic('trash')}</button></div>
        <div class="ax-row c3"><label class="ax-f"><span>Nome</span><input data-f="services.${i}.name" value="${esc(s.name)}"></label>
        <label class="ax-f"><span>Duração (min)</span><input type="number" min="5" step="5" data-f="services.${i}.duration" value="${esc(s.duration)}"></label>
        <label class="ax-f"><span>Preço (R$)</span><input type="number" min="0" step="0.01" data-f="services.${i}.price" value="${s.price ?? ''}" placeholder="Sob consulta"></label></div>
        <div class="ax-row c2"><label class="ax-f"><span>Descrição</span><input data-f="services.${i}.desc" value="${esc(s.desc)}"></label>
        <label class="ax-f"><span>Categoria</span><select data-f="services.${i}.kind"><option value="corte" ${s.kind !== 'barba' ? 'selected' : ''}>Corte · tesoura</option><option value="barba" ${s.kind === 'barba' ? 'selected' : ''}>Barba · navalha</option></select></label></div></div>`;
      return `<p class="ax-note">A categoria define o grupo no site e o objeto 3D que acompanha o serviço. Preço vazio aparece como “Sob consulta”.</p>
        ${['corte', 'barba'].map((k) => `<div class="ax-ph"><h2>${k === 'corte' ? 'Tesoura · Corte' : 'Navalha · Barba'}</h2><button class="ax-link" data-add="services|${k}">${ic('plus')}Adicionar</button></div>` + d.services.map((s, i) => ((s.kind === 'barba' ? 'barba' : 'corte') === k ? card(s, i) : '')).join('')).join('')}`;
    }
    if (page === 'equipe') {
      const media = S()?.media || {};
      return `<p class="ax-note">Sem profissionais cadastrados, a agenda funciona como “Equipe da casa”. Com dois ou mais, o cliente escolhe com quem agendar.</p>
        <div class="ax-ph"><h2>${d.barbers.length} profissiona${d.barbers.length === 1 ? 'l' : 'is'}</h2><button class="ax-link" data-add="barbers">${ic('plus')}Adicionar</button></div>
        ${d.barbers.map((b, i) => `<div class="ax-item person"><label class="ax-photo" style="background-image:url('${media['barber_' + b.id] || ''}')"><input type="file" accept="image/*" hidden data-up="barber_${esc(b.id)}"><span>${media['barber_' + b.id] ? 'Trocar foto' : 'Enviar foto'}</span></label>
          <div class="ax-person"><div class="ax-item-h"><label class="ax-switch"><input type="checkbox" data-f="barbers.${i}.active" ${b.active !== false ? 'checked' : ''}><i></i><span>${b.active !== false ? 'Atendendo' : 'Inativo'}</span></label><button class="ax-icon" data-del="barbers.${i}" aria-label="Remover">${ic('trash')}</button></div>
          <div class="ax-row c2"><label class="ax-f"><span>Nome</span><input data-f="barbers.${i}.name" value="${esc(b.name)}"></label><label class="ax-f"><span>Especialidade</span><input data-f="barbers.${i}.specialty" value="${esc(b.specialty)}"></label></div>
          <label class="ax-f"><span>Breve descrição</span><input data-f="barbers.${i}.bio" value="${esc(b.bio)}"></label>
          <div class="ax-f"><span>Dias de atendimento</span><div class="ax-chips">${[1, 2, 3, 4, 5, 6, 0].map((k) => `<label class="ax-chip"><input type="checkbox" data-bday="${i}|${k}" ${(b.days || []).includes(k) ? 'checked' : ''}><span>${WD[k].slice(0, 3)}</span></label>`).join('')}</div></div></div></div>`).join('') || `<p class="ax-empty">Nenhum profissional cadastrado.</p>`}`;
    }
    if (page === 'horarios') return `<p class="ax-note">A agenda só oferece horários que cabem inteiros dentro do expediente, fora das pausas e dos bloqueios.</p>
      <div class="ax-panel"><div class="ax-ph"><h2>Expediente</h2></div>${[1, 2, 3, 4, 5, 6, 0].map((w) => { const h = d.hours[w];
        return `<div class="ax-hour ${h ? '' : 'off'}"><b>${WD[w]}</b><label class="ax-switch"><input type="checkbox" data-open="${w}" ${h ? 'checked' : ''}><i></i><span>${h ? 'Aberto' : 'Fechado'}</span></label><input type="time" data-h="${w}|o" value="${h?.o || ''}" ${h ? '' : 'disabled'}><span class="ax-dash">até</span><input type="time" data-h="${w}|c" value="${h?.c || ''}" ${h ? '' : 'disabled'}></div>`; }).join('')}</div>
      <div class="ax-panel"><div class="ax-ph"><h2>Regras da agenda</h2></div><div class="ax-row c3">
        <label class="ax-f"><span>Pausa · início</span><input type="time" data-f="breaks.0.s" value="${d.breaks[0]?.s || ''}"></label><label class="ax-f"><span>Pausa · fim</span><input type="time" data-f="breaks.0.e" value="${d.breaks[0]?.e || ''}"></label>
        <label class="ax-f"><span>Grade de horários (min)</span><input type="number" min="5" step="5" data-f="step" value="${d.step}"></label>
        <label class="ax-f"><span>Intervalo entre clientes (min)</span><input type="number" min="0" step="5" data-f="buffer" value="${d.buffer}"></label>
        <label class="ax-f"><span>Antecedência mínima (min)</span><input type="number" min="0" step="15" data-f="lead" value="${d.lead}"></label>
        <label class="ax-f"><span>Agenda aberta (dias)</span><input type="number" min="1" max="180" data-f="horizon" value="${d.horizon}"></label></div></div>`;
    if (page === 'bloqueios') return `<p class="ax-note">Feriados, folgas e compromissos. Sem início e fim, o dia inteiro fica bloqueado.</p>
      <div class="ax-ph"><h2>${d.blocks.length} bloqueio${d.blocks.length === 1 ? '' : 's'}</h2><button class="ax-link" data-add="blocks">${ic('plus')}Adicionar</button></div>
      ${d.blocks.map((b, i) => `<div class="ax-item"><div class="ax-row c5"><label class="ax-f"><span>Data</span><input type="date" data-f="blocks.${i}.date" value="${esc(b.date)}"></label>
        <label class="ax-f"><span>Profissional</span><select data-f="blocks.${i}.barberId"><option value="all">Todos</option>${d.barbers.map((x) => `<option value="${esc(x.id)}" ${b.barberId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="ax-f"><span>Início</span><input type="time" data-f="blocks.${i}.s" value="${esc(b.s)}"></label><label class="ax-f"><span>Fim</span><input type="time" data-f="blocks.${i}.e" value="${esc(b.e)}"></label>
        <label class="ax-f"><span>Motivo</span><input data-f="blocks.${i}.reason" value="${esc(b.reason)}" placeholder="Opcional"></label></div><button class="ax-icon end" data-del="blocks.${i}" aria-label="Remover">${ic('trash')}</button></div>`).join('') || `<p class="ax-empty">Nenhum bloqueio.</p>`}`;
    if (page === 'casa') { const b = d.business; const media = S()?.media || {}; const f = (k, l, ph = '') => `<label class="ax-f"><span>${l}</span><input data-f="business.${k}" value="${esc(b[k])}" placeholder="${ph}"></label>`;
      return `<p class="ax-note">Somente informações reais. Campos vazios não aparecem no site.</p>
      <div class="ax-panel"><div class="ax-ph"><h2>Dados da barbearia</h2></div><div class="ax-row c3">${f('name', 'Nome')}${f('whatsapp', 'WhatsApp (DDI + DDD)', '5515999999999')}${f('instagram', 'Instagram', '@suabarbearia')}</div>
        <div class="ax-row c3">${f('address', 'Endereço')}${f('city', 'Cidade / UF')}${f('maps', 'Link de rotas', 'https://maps.app.goo.gl/…')}</div>
        <label class="ax-f"><span>Horários no rodapé (opcional)</span><textarea data-f="business.hoursText" placeholder="Se vazio, usa o expediente">${esc(b.hoursText)}</textarea></label></div>
      <div class="ax-panel"><div class="ax-ph"><h2>Fotos do espaço</h2><small>reduzidas automaticamente</small></div><div class="ax-gal">${[0, 1, 2, 3, 4].map((i) => `<div class="ax-gi"><label class="ax-photo wide" style="background-image:url('${media['gal' + i] || ''}')"><input type="file" accept="image/*" hidden data-up="gal${i}"><span>${media['gal' + i] ? 'Trocar' : 'Enviar foto'}</span></label>
        <input data-f="gallery.${i}" value="${esc(d.gallery[i])}" placeholder="Legenda">${media['gal' + i] ? `<button class="ax-link danger" data-rmimg="gal${i}">Remover foto</button>` : ''}</div>`).join('')}</div></div>
      ${S()?.authMode === 'firebase' ? `<div class="ax-panel"><div class="ax-ph"><h2>Acesso ao painel</h2><small>${esc(S().user?.email || '')}</small></div><form class="ax-row c3" data-form="fbpass"><label class="ax-f"><span>Nova senha</span><input name="pass" type="password" minlength="8" autocomplete="new-password"></label><div class="ax-f"><span>&nbsp;</span><button class="ax-btn" type="submit">Trocar senha</button></div></form><p class="ax-err" id="axPassMsg"></p></div>` : `<div class="ax-panel"><div class="ax-ph"><h2>Acesso ao painel</h2></div><form class="ax-row c3" data-form="pass"><label class="ax-f"><span>Usuário</span><input name="user" value="${esc(cred?.user || '')}" autocomplete="username"></label>
        <label class="ax-f"><span>Nova senha</span><input name="pass" type="password" minlength="8" autocomplete="new-password"></label><div class="ax-f"><span>&nbsp;</span><button class="ax-btn" type="submit">Atualizar acesso</button></div></form><p class="ax-err" id="axPassMsg"></p></div>`}`; }
    return '';
  }
  function rowBooking(b) {
    const cx = b.status === 'cancelled';
    return `<div class="ax-bk ${cx ? 'cx' : ''}"><div class="ax-time"><b>${fmtMin(b.start)}</b><small>${fmtMin(b.end)}</small></div>
      <div class="ax-who"><b>${esc(b.name)}</b><small>${esc(b.serviceName)} · ${esc(b.barberName || barberName(b.barberId))}${page === 'overview' ? ` · ${fmtDay(b.date)}` : ''}</small></div>
      <a class="ax-icon" href="https://wa.me/55${esc(String(b.phone).replace(/^55/, ''))}" target="_blank" rel="noopener" title="${esc(fmtPhone(b.phone))}">${ic('wa')}</a>
      ${cx ? `<span class="ax-tag off">Cancelada</span>` : `<span class="ax-tag ok">Confirmada</span><button class="ax-link danger" data-cancel="${esc(b.uid)}|${esc(b.id)}">Cancelar</button>`}</div>`;
  }
  function manualForm() {
    const m = manual; const svcs = activeServices(draft); const bars = activeBarbers(draft);
    const svc = svcs.find((s) => s.id === m.svc) || svcs[0]; m.svc = svc?.id;
    const av = svc ? availability(draft, S()?.slots || [], svc, m.barber || 'any', parseKey(m.date || day)) : new Map();
    return `<div class="ax-modal"><form class="ax-card wide" data-form="manual"><div class="ax-ph"><h2>Nova reserva</h2><button type="button" class="ax-icon" data-act="manual-x">${ic('x')}</button></div>
      <div class="ax-row c3"><label class="ax-f"><span>Serviço</span><select name="svc" data-m="svc">${svcs.map((s) => `<option value="${esc(s.id)}" ${s.id === m.svc ? 'selected' : ''}>${esc(s.name)} · ${s.duration} min</option>`).join('')}</select></label>
      <label class="ax-f"><span>Profissional</span><select data-m="barber"><option value="any">Primeiro disponível</option>${bars.map((b) => `<option value="${esc(b.id)}" ${m.barber === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label class="ax-f"><span>Data</span><input type="date" data-m="date" value="${m.date || day}"></label></div>
      <div class="ax-f"><span>Horário</span><div class="ax-slots">${av.size ? [...av.entries()].map(([t, bs]) => `<button type="button" data-mt="${t}|${bs.join(',')}" class="${m.t === t ? 'on' : ''}">${fmtMin(t)}</button>`).join('') : '<p class="ax-empty">Sem horários livres nesta data.</p>'}</div></div>
      <div class="ax-row c2"><label class="ax-f"><span>Nome do cliente</span><input name="name" required minlength="3" value="${esc(m.name || '')}" data-m="name"></label><label class="ax-f"><span>Telefone</span><input name="phone" required inputmode="tel" value="${esc(m.phone || '')}" data-m="phone"></label></div>
      <p class="ax-err">${esc(m.err || '')}</p><button class="ax-btn primary wide" type="submit" ${m.t == null ? 'disabled' : ''}>Confirmar reserva</button></form></div>`;
  }

  // ---------- events ----------
  function setPath(path, val) { const ks = path.split('.'); let o = draft; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; } o[ks.at(-1)] = val; markDirty(); }
  function markDirty() { dirty = true; const st = $('#axStatus', root); if (st) st.textContent = 'Alterações não salvas'; const b = $('[data-act=save]', root); if (b) b.disabled = false; }
  async function shrink(file) {
    const img = await createImageBitmap(file); const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = 0.82, out = c.toDataURL('image/jpeg', q); while (out.length > 240000 && q > 0.4) { q -= 0.08; out = c.toDataURL('image/jpeg', q); } return out;
  }
  function clean() { draft.breaks = (draft.breaks || []).filter((b) => b && b.s && b.e); for (const s of draft.services) { s.duration = Math.max(5, +s.duration || 30); if (s.price === '' || s.price == null || isNaN(+s.price)) s.price = null; }
    draft.step = Math.max(5, +draft.step || 15); draft.buffer = Math.max(0, +draft.buffer || 0); draft.lead = Math.max(0, +draft.lead || 0); draft.horizon = Math.min(180, Math.max(1, +draft.horizon || 45)); }
  async function onClick(e) {
    const t = e.target;
    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'close') return close();
    if (act === 'peek') { const i = t.closest('.ax-pw').querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; return; }
    if (act === 'drawer') { drawer = !drawer; return render(); }
    if (act === 'logout') { try { sessionStorage.removeItem(SESSION); } catch (er) {} draft = null; if (S()?.authMode === 'firebase') { await S().signOut(); return loginFb(); } return login(); }
    if (act === 'reset') { const em = $('input[name=user]', root).value.trim(); const err = $('.ax-err', root); if (!em) { err.textContent = 'Digite seu e-mail acima e clique de novo.'; return; } const r = await S().resetPassword(em); err.textContent = r.ok ? 'Enviamos um link de redefinição para o seu e-mail.' : r.error; return; }
    if (act === 'manual') { if (page !== 'agenda') page = 'agenda'; manual = { date: day, barber: 'any' }; return render(); }
    if (act === 'manual-x') { manual = null; return render(); }
    if (act === 'save') { const st = $('#axStatus', root), btn = t.closest('button'); btn.disabled = true; st.textContent = 'Salvando…';
      try { clean(); await S().saveConfig(draft); dirty = false; st.textContent = 'Salvo ✓'; } catch (er) { btn.disabled = false; st.textContent = 'Não foi possível salvar' + (er?.code ? ` (${er.code})` : ''); } return; }
    const pg = t.closest('[data-page]'); if (pg) { if (dirty && EDIT.includes(page) && !confirmLeave()) return; page = pg.dataset.page; drawer = false; manual = null; return render(); }
    const dd = t.closest('[data-day]'); if (dd) { day = dd.dataset.day; return render(); }
    const fl = t.closest('[data-filt]'); if (fl) { filt = fl.dataset.filt; return render(); }
    const add = t.closest('[data-add]'); if (add) { const [k, kind] = add.dataset.add.split('|');
      if (k === 'services') draft.services.push({ id: rid(), name: 'Novo serviço', desc: '', kind: kind || 'corte', duration: 30, price: null, active: true });
      if (k === 'barbers') draft.barbers.push({ id: rid(), name: 'Novo profissional', specialty: '', bio: '', days: [2, 3, 4, 5, 6], active: true });
      if (k === 'blocks') draft.blocks.push({ id: rid(), date: dayKey(new Date()), barberId: 'all', s: '', e: '', reason: '' });
      markDirty(); return render(); }
    const del = t.closest('[data-del]'); if (del) { const [k, i] = del.dataset.del.split('.'); draft[k].splice(+i, 1); markDirty(); return render(); }
    const cx = t.closest('[data-cancel]'); if (cx) { if (cx.dataset.sure !== '1') { cx.dataset.sure = '1'; cx.textContent = 'Confirmar cancelamento'; setTimeout(() => { if (cx.isConnected) { cx.dataset.sure = ''; cx.textContent = 'Cancelar'; } }, 3500); return; }
      const [u, id] = cx.dataset.cancel.split('|'); cx.textContent = 'Cancelando…'; try { await S().cancel(u, id); } catch (er) { cx.textContent = 'Erro'; } return; }
    const rm = t.closest('[data-rmimg]'); if (rm) { await S().saveMedia(rm.dataset.rmimg, null); return render(); }
    const mt = t.closest('[data-mt]'); if (mt) { const [tt, bs] = mt.dataset.mt.split('|'); manual.t = +tt; manual.bars = bs.split(','); return render(); }
  }
  const confirmLeave = () => { const st = $('#axStatus', root); if (st && st.dataset.warn === '1') { dirty = false; draft = JSON.parse(JSON.stringify(ctx.cfg())); return true; } if (st) { st.dataset.warn = '1'; st.innerHTML = '<b>Salve ou clique de novo para descartar.</b>'; } return false; };
  function onInput(e) { const t = e.target; if (t.dataset.m && manual) { manual[t.dataset.m] = t.dataset.m === 'phone' ? fmtPhone(t.value) : t.value; if (t.dataset.m === 'phone') t.value = manual.phone; } }
  async function onChange(e) {
    const t = e.target;
    if (t.dataset.f) { let v = t.type === 'checkbox' ? t.checked : t.value; if (t.type === 'number') v = t.value === '' ? null : +t.value; setPath(t.dataset.f, v); if (t.type === 'checkbox' || t.tagName === 'SELECT') render(); return; }
    if (t.dataset.bday) { const [i, k] = t.dataset.bday.split('|').map(Number); const b = draft.barbers[i]; b.days = b.days || []; if (t.checked) { if (!b.days.includes(k)) b.days.push(k); } else b.days = b.days.filter((x) => x !== k); return markDirty(); }
    if (t.dataset.open) { draft.hours[t.dataset.open] = t.checked ? { o: '09:00', c: '19:00' } : null; markDirty(); return render(); }
    if (t.dataset.h) { const [w, k] = t.dataset.h.split('|'); draft.hours[w] = draft.hours[w] || {}; draft.hours[w][k] = t.value; return markDirty(); }
    if (t.dataset.m && manual && ['svc', 'barber', 'date'].includes(t.dataset.m)) { manual[t.dataset.m] = t.value; manual.t = null; return render(); }
    if (t.dataset.up && t.files[0]) { const lab = t.closest('label'); lab.classList.add('busy');
      try { await S().saveMedia(t.dataset.up, await shrink(t.files[0])); } catch (er) { alertLine('Falha ao enviar a imagem.'); } render(); }
  }
  function alertLine(m) { const st = $('#axStatus', root); if (st) st.textContent = m; }
  async function onSubmit(e) {
    e.preventDefault(); const f = e.target;
    if (f.dataset.form === 'login' || f.dataset.form === 'setup') return doLogin(f);
    if (f.dataset.form === 'fblogin' || f.dataset.form === 'fbsetup') return doLoginFb(f);
    if (f.dataset.form === 'fbpass') { const msg = $('#axPassMsg', root); const pass = f.pass.value; if (pass.length < 8) { msg.textContent = 'Use pelo menos 8 caracteres.'; return; } const r = await S().changePassword(pass); msg.textContent = r.ok ? 'Senha atualizada ✓' : r.error; if (r.ok) f.pass.value = ''; return; }
    if (f.dataset.form === 'pass') { const msg = $('#axPassMsg', root); const user = f.user.value.trim().toLowerCase(), pass = f.pass.value;
      if (user.length < 3 || pass.length < 8) { msg.textContent = 'Usuário com 3+ caracteres e senha com 8+.'; return; }
      try { const h = await hashPass(pass); cred = { user, ...h, createdAt: new Date().toISOString() }; await saveCred(cred); startSession(); msg.textContent = 'Acesso atualizado ✓'; f.pass.value = ''; } catch (er) { msg.textContent = 'Não foi possível atualizar o acesso.'; } return; }
    if (f.dataset.form === 'manual') { const m = manual; const svc = activeServices(draft).find((s) => s.id === m.svc);
      m.err = ''; const r = await S().book({ service: svc, barberIds: m.bars || [], date: m.date || day, start: m.t, name: m.name || '', phone: m.phone || '' });
      if (!r.ok) { m.err = r.error; m.t = r.taken ? null : m.t; return render(); }
      day = m.date || day; manual = null; render(); }
  }
  return { open, close, refresh: () => { if (root && root.classList.contains('show') && draft && !dirty) { draft = JSON.parse(JSON.stringify(ctx.cfg())); render(); } else if (root && root.classList.contains('show') && draft && ['overview', 'agenda'].includes(page)) render(); } };
}
