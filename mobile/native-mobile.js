// Adaptador móvil nativo: fuerza el servidor local, bloquea funciones online
// y conserva la expedición en localStorage entre cierres de la aplicación.
(function () {
  'use strict';

  window.NATIVE_MOBILE = true;
  window.MODO_LOCAL = true;
  try { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); } catch (_) {}

  // El APK no posee permiso INTERNET y WebView bloquea cargas de red. Este
  // filtro evita además intentos innecesarios como el censo de la portada.
  const fetchOriginal = window.fetch ? window.fetch.bind(window) : null;
  if (fetchOriginal) {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : String(input && input.url || '');
      if (url === 'censo' || /^https?:\/\//i.test(url) || /^wss?:\/\//i.test(url)) {
        return Promise.reject(new TypeError('Modo móvil sin conexión'));
      }
      return fetchOriginal(input, init);
    };
  }

  // Valores prudentes para teléfonos la primera vez; nunca pisa preferencias.
  try {
    if (!localStorage.getItem('backrooms-opts')) {
      localStorage.setItem('backrooms-opts', JSON.stringify({
        fpsMax: '60', resolucion: 'auto16x9', camaraModo: 'libre',
        camaraInvertir: true, camaraSens: 90, camaraSeguimiento: 8,
        dado: true, mostrarFps: false, cursorSpeed: 8, menuMusica: 'menu1'
      }));
    }
  } catch (_) {}

  const SAVE_PREFIX = 'backrooms-mobile-run::';
  let restoreData = null;
  let saveTimer = null;

  function profileName() {
    try {
      return window.Game && Game.Profiles && Game.Profiles.activeName()
        ? Game.Profiles.activeName()
        : 'Errante';
    } catch (_) { return 'Errante'; }
  }

  function saveKey() { return SAVE_PREFIX + profileName(); }

  function loadSnapshot() {
    try {
      const raw = localStorage.getItem(saveKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.version === 1 ? data : null;
    } catch (_) { return null; }
  }

  function baseFromRoom(room) {
    if (!room || !room.semilla) return null;
    const suffix = `::${room.nivelId}::${room.inst}`;
    return room.semilla.endsWith(suffix)
      ? room.semilla.slice(0, -suffix.length)
      : null;
  }

  function roomKey(levelId, inst) { return `${levelId}::${inst || 1}`; }

  function serializeRoom(room) {
    return {
      nivelId: room.nivelId,
      inst: room.inst,
      entidades: (room.entidades || []).map((e) => ({
        uid: e.uid, x: e.x, y: e.y, viva: e.viva,
        revelada: !!e.revelada, preparando: !!e.preparando
      })),
      abiertas: (room.map && room.map.exits || [])
        .map((ex, i) => ex.def && ex.def._abierta ? i : -1)
        .filter((i) => i >= 0)
    };
  }

  function serializePlayer(j) {
    return {
      x: j.x, y: j.y, rot: j.rot,
      salud: j.salud, sed: j.sed, cordura: j.cordura,
      inv: Array.isArray(j.inv) ? j.inv.slice() : [],
      manos: Array.isArray(j.manos) ? j.manos.slice() : [null, null],
      equipo: Object.assign({ cara: null, cuerpo: null, pies: null }, j.equipo || {}),
      luz: !!j.luz,
      distSala: Number(j.distSala || 0),
      retorno: j.retorno || null,
      caminataObjetivo: Number(j.caminataObjetivo || 0),
      caminataPasos: Number(j.caminataPasos || 0),
      nivelesProtegidos: j.nivelesProtegidos ? Array.from(j.nivelesProtegidos) : []
    };
  }

  function saveSnapshot() {
    try {
      if (!window.Local || !Local.jugador || !Local.sala || !window.Salas) return;
      const data = {
        version: 1,
        savedAt: Date.now(),
        semillaBase: baseFromRoom(Local.sala),
        currentLevel: Local.sala.nivelId,
        currentInst: Local.sala.inst,
        player: serializePlayer(Local.jugador),
        rooms: Salas.todas().map(serializeRoom)
      };
      localStorage.setItem(saveKey(), JSON.stringify(data));
    } catch (err) {
      console.warn('[mobile] no se pudo guardar la expedición', err);
    }
  }

  function applyRoomState(room, data) {
    if (!room || !data || !Array.isArray(data.rooms)) return;
    const snap = data.rooms.find((r) => roomKey(r.nivelId, r.inst) === roomKey(room.nivelId, room.inst));
    if (!snap) return;
    const byUid = new Map((snap.entidades || []).map((e) => [e.uid, e]));
    for (const entity of room.entidades || []) {
      const saved = byUid.get(entity.uid);
      if (!saved) continue;
      entity.x = saved.x; entity.y = saved.y;
      entity.viva = saved.viva;
      entity.revelada = !!saved.revelada;
      entity.preparando = !!saved.preparando;
    }
    const abiertas = new Set(snap.abiertas || []);
    for (let i = 0; i < (room.map && room.map.exits || []).length; i++) {
      if (room.map.exits[i].def) room.map.exits[i].def._abierta = abiertas.has(i);
    }
  }

  function applyPlayerState(j, p) {
    if (!j || !p) return;
    for (const k of ['x', 'y', 'rot', 'salud', 'sed', 'cordura', 'distSala', 'caminataObjetivo', 'caminataPasos']) {
      if (Number.isFinite(p[k])) j[k] = p[k];
    }
    j.inv = Array.isArray(p.inv) ? p.inv.slice(0, 6) : [];
    j.manos = Array.isArray(p.manos) ? p.manos.slice(0, 2) : [null, null];
    while (j.manos.length < 2) j.manos.push(null);
    j.equipo = Object.assign({ cara: null, cuerpo: null, pies: null }, p.equipo || {});
    j.luz = !!p.luz;
    j.retorno = p.retorno || null;
    j.nivelesProtegidos = new Set(p.nivelesProtegidos || []);
    j.rx = j.x; j.ry = j.y;
  }

  if (window.Salas && window.Local) {
    const originalSetBase = Salas.fijarSemillaBase.bind(Salas);
    Salas.fijarSemillaBase = function (base) {
      const forced = restoreData && restoreData.semillaBase;
      originalSetBase(forced || base);
    };

    const originalAssign = Salas.asignar.bind(Salas);
    Salas.asignar = function (nivelId, grupo) {
      const room = originalAssign(nivelId, grupo);
      if (restoreData) applyRoomState(room, restoreData);
      return room;
    };

    const originalConnect = Local.conectar.bind(Local);
    Local.conectar = function (nombre, receiver, nivelInicial) {
      restoreData = loadSnapshot();
      const targetLevel = restoreData && restoreData.currentLevel
        ? restoreData.currentLevel
        : nivelInicial;
      const wrappedReceiver = function (message) {
        if (message && message.t === 'bienvenida' && restoreData && Local.jugador) {
          applyPlayerState(Local.jugador, restoreData.player || {});
          const j = Local.jugador;
          Object.assign(message, {
            x: j.x, y: j.y, rot: j.rot,
            salud: j.salud, sed: j.sed, cordura: j.cordura,
            inv: j.inv, manos: j.manos, equipo: j.equipo,
            retorno: j.retorno,
            caminata: j.caminataObjetivo
              ? { pasos: j.caminataPasos || 0, objetivo: j.caminataObjetivo }
              : null,
            ents: Local.sala.estadoDinamico().ents,
            abiertas: Local.sala.estadoDinamico().abiertas
          });
        }
        receiver(message);
      };
      const socket = originalConnect(nombre, wrappedReceiver, targetLevel);
      if (restoreData && Local.jugador) applyPlayerState(Local.jugador, restoreData.player || {});
      if (!saveTimer) saveTimer = setInterval(saveSnapshot, 4000);
      return socket;
    };
  }

  function clearCurrentRun() {
    try {
      const old = loadSnapshot();
      localStorage.removeItem(saveKey());
      if (old && old.semillaBase) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mmo-cajas::') && key.includes(old.semillaBase)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (_) {}
  }

  function adaptInterface() {
    document.body.classList.add('native-mobile');
    const h1 = document.querySelector('#screen-title h1');
    const subtitle = document.querySelector('#screen-title .subtitle');
    const census = document.getElementById('backrooms-census');
    const censusText = document.getElementById('backrooms-census-text');
    const start = document.getElementById('btn-start');
    const offline = document.getElementById('btn-offline');
    const room = document.querySelector('.room-row');
    const cont = document.getElementById('btn-continue');
    if (h1) h1.textContent = 'BACKROOMS: NO-CLIP';
    if (subtitle) subtitle.textContent = 'edición móvil · mundo local sin conexión';
    if (census) census.classList.add('census-offline');
    if (censusText) censusText.textContent = 'MODO LOCAL — no se usa ningún servidor';
    if (start) start.textContent = 'CONTINUAR / INICIAR EXPEDICIÓN';
    if (offline) offline.style.display = 'none';
    if (room) room.style.display = 'none';
    if (cont) cont.style.display = 'none';

    if (!document.getElementById('btn-mobile-new-run') && start && start.parentNode) {
      const button = document.createElement('button');
      button.id = 'btn-mobile-new-run';
      button.className = 'btn-small mobile-new-run';
      button.textContent = 'Nueva expedición (borrar partida actual)';
      button.onclick = function () {
        if (!confirm('¿Borrar la expedición local actual y empezar de cero?')) return;
        clearCurrentRun();
        location.reload();
      };
      start.insertAdjacentElement('afterend', button);
    }

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        link.addEventListener('click', (ev) => {
          ev.preventDefault();
          alert('Este enlace pertenece a la wiki y no está disponible dentro del modo sin conexión.');
        });
      }
    });
  }

  adaptInterface();
  setTimeout(adaptInterface, 0);
  setTimeout(adaptInterface, 500);
  window.addEventListener('pagehide', saveSnapshot);
  window.addEventListener('beforeunload', saveSnapshot);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveSnapshot();
  });
})();
