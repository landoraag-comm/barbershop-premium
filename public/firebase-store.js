// ===== Firebase backend (used when the site runs on Firebase Hosting) =====
// Firestore keeps the agenda; Firebase Authentication protects the admin area.
// Double bookings are blocked on the server: every booked 5-minute unit is a lock document that
// can only be *created*, so two clients writing the same unit make the second batch fail.
const V = '10.12.2';
const FB = `https://www.gstatic.com/firebasejs/${V}`;

async function loadConfig() {
  if (window.__FIREBASE_CONFIG__) return window.__FIREBASE_CONFIG__;
  try { const r = await fetch('/__/firebase/init.json'); if (r.ok) return await r.json(); } catch (e) {}
  const m = await import('./firebase-config.js'); return m.default;
}

export async function createFirebaseStore(listeners, H) {
  const [{ initializeApp }, fs, au] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-firestore.js`), import(`${FB}/firebase-auth.js`)]);
  const { getFirestore, doc, collection, onSnapshot, setDoc, getDoc, getDocs, query, where, writeBatch, deleteDoc, updateDoc } = fs;
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword } = au;
  const app = initializeApp(await loadConfig());
  const db = getFirestore(app); const auth = getAuth(app);
  const emit = (k) => listeners[k] && listeners[k]();
  const S = { mode: 'live', authMode: 'firebase', config: H.merge(null), slots: [], media: {}, bookings: [], canEdit: false, uid: 'public', note: '' };
  const UNIT = 5;
  const today = () => H.dayKey(new Date());
  const monthAgo = () => H.dayKey(new Date(Date.now() - 31 * 864e5));

  let gotCfg = false; const timer = setTimeout(() => { if (!gotCfg) { S.note = 'A agenda está demorando para responder.'; emit('mode'); } }, 10000);
  onSnapshot(doc(db, 'config', 'main'), (snap) => { gotCfg = true; clearTimeout(timer); S.note = ''; S.config = H.merge(snap.exists() ? snap.data() : null); emit('config'); emit('mode'); }, () => { clearTimeout(timer); emit('config'); });
  onSnapshot(query(collection(db, 'slots'), where('date', '>=', H.dayKey(new Date(Date.now() - 864e5)))), (snap) => { S.slots = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())); emit('slots'); }, () => {});
  onSnapshot(collection(db, 'media'), (snap) => { const m = {}; snap.forEach((d) => { m[d.id] = d.data().data; }); S.media = m; emit('media'); }, () => {});

  // ----- auth / admin -----
  let unsubBookings = null;
  onAuthStateChanged(auth, async (user) => {
    S.user = user; S.canEdit = false;
    if (unsubBookings) { unsubBookings(); unsubBookings = null; }
    if (user) { try { S.canEdit = (await getDoc(doc(db, 'admins', user.uid))).exists(); } catch (e) { S.canEdit = false; } }
    if (S.canEdit) unsubBookings = onSnapshot(query(collection(db, 'bookings'), where('date', '>=', monthAgo())), (snap) => { S.bookings = snap.docs.map((d) => Object.assign({ uid: 'fb', id: d.id }, d.data())); emit('bookings'); }, () => {});
    else S.bookings = [];
    emit('mode'); emit('bookings'); S._authWaiters.splice(0).forEach((f) => f());
  });
  S._authWaiters = [];
  S.authReady = () => new Promise((r) => { if (S.user !== undefined) r(); else S._authWaiters.push(r); });
  S.ownerExists = async () => { try { return (await getDoc(doc(db, 'meta', 'owner'))).exists(); } catch (e) { return true; } };
  const authErr = (e) => ({ 'auth/invalid-credential': 'E-mail ou senha inválidos.', 'auth/wrong-password': 'E-mail ou senha inválidos.', 'auth/user-not-found': 'E-mail ou senha inválidos.', 'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.', 'auth/email-already-in-use': 'Este e-mail já tem uma conta. Use “Entrar”.', 'auth/weak-password': 'Senha fraca: use pelo menos 8 caracteres.', 'auth/invalid-email': 'E-mail inválido.', 'auth/operation-not-allowed': 'Ative o login por e-mail e senha no Firebase Authentication.' }[e?.code] || (e?.message || 'Não foi possível entrar.'));
  S.signIn = async (email, pass) => {
    try { const c = await signInWithEmailAndPassword(auth, email, pass); const ok = (await getDoc(doc(db, 'admins', c.user.uid))).exists(); if (!ok) { await signOut(auth); throw { message: 'Esta conta não tem acesso ao painel.' }; } S.canEdit = true; return { ok: true }; }
    catch (e) { return { ok: false, error: authErr(e) }; }
  };
  // first access: creates the owner account and claims the admin role (allowed only while no owner exists)
  S.setupOwner = async (email, pass) => {
    try {
      if (await S.ownerExists()) return { ok: false, error: 'O painel já tem um responsável. Use “Entrar”.' };
      const c = await createUserWithEmailAndPassword(auth, email, pass);
      const b = writeBatch(db); b.set(doc(db, 'meta', 'owner'), { uid: c.user.uid, at: new Date().toISOString() }); b.set(doc(db, 'admins', c.user.uid), { email, role: 'owner', at: new Date().toISOString() });
      await b.commit(); S.canEdit = true; return { ok: true };
    } catch (e) { return { ok: false, error: authErr(e) }; }
  };
  S.signOut = () => signOut(auth);
  S.resetPassword = async (email) => { try { await sendPasswordResetEmail(auth, email); return { ok: true }; } catch (e) { return { ok: false, error: authErr(e) }; } };
  S.changePassword = async (pass) => { try { await updatePassword(auth.currentUser, pass); return { ok: true }; } catch (e) { return { ok: false, error: e?.code === 'auth/requires-recent-login' ? 'Por segurança, saia e entre de novo antes de trocar a senha.' : authErr(e) }; } };

  // ----- booking -----
  S.book = async ({ service, barberIds, date, start, name, phone }) => {
    const end = start + (+service.duration || 30); const cfg = S.config; const all = H.activeBarbers(cfg); const buf = +cfg.buffer || 0;
    if (!name || name.trim().length < 3) return { ok: false, error: 'Informe seu nome.' };
    const digits = String(phone).replace(/\D/g, ''); if (digits.length < 10 || digits.length > 11) return { ok: false, error: 'Telefone inválido.' };
    for (const bid of barberIds) {
      const barber = all.find((b) => b.id === bid); if (!barber) continue;
      if (!H.freeStarts(cfg, S.slots, service, barber, H.parseKey(date)).includes(start)) continue;
      const ref = doc(collection(db, 'bookings')); const id = ref.id;
      const locks = []; for (let m = Math.floor(start / UNIT) * UNIT; m < end + buf; m += UNIT) locks.push(`${bid}_${date}_${m}`);
      const slot = { barberId: bid, date, start, end, status: 'confirmed', locks };
      const bk = Object.assign({}, slot, { serviceId: service.id, serviceName: service.name, barberName: barber.name, name: name.trim().slice(0, 60), phone: digits, createdAt: new Date().toISOString() });
      const b = writeBatch(db);
      b.set(doc(db, 'slots', id), slot); b.set(ref, bk);
      for (const l of locks) b.set(doc(db, 'locks', l), { booking: id });
      try { await b.commit(); return { ok: true, booking: Object.assign({ id }, bk) }; }
      catch (e) { if (e?.code === 'permission-denied') continue; return { ok: false, error: 'Não foi possível registrar a reserva. Verifique a conexão e tente de novo.' }; }
    }
    return { ok: false, error: 'Esse horário acabou de ser reservado. Escolha outro, por favor.', taken: true };
  };

  // ----- admin writes -----
  S.saveConfig = async (cfg) => { cfg = JSON.parse(JSON.stringify(cfg)); cfg.configured = true; await setDoc(doc(db, 'config', 'main'), cfg); };
  S.saveMedia = async (key, data) => { if (data) await setDoc(doc(db, 'media', key), { data }); else await deleteDoc(doc(db, 'media', key)); };
  S.cancel = async (_uid, id) => {
    const bk = S.bookings.find((x) => x.id === id); const b = writeBatch(db);
    b.update(doc(db, 'bookings', id), { status: 'cancelled' }); b.update(doc(db, 'slots', id), { status: 'cancelled' });
    for (const l of (bk?.locks || [])) b.delete(doc(db, 'locks', l));
    await b.commit();
  };
  S.getSecure = async () => null; S.setSecure = async () => {};
  emit('mode');
  return S;
}
