const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const QR = require('qrcode');
const { Server } = require('socket.io');
const cfg = require('./config');
const GAMES = {
  tateti: require('./games/tateti'), adivina: require('./games/adivina'), ahorcado: require('./games/ahorcado'),
  naval: require('./games/naval'), desconfio: require('./games/desconfio')
};

const G = cfg.global, GRACE = G.graceSeconds * 1000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e4, pingInterval: 10000, pingTimeout: 30000 });
const rooms = new Map(), players = new Map(), tokens = new Map(), ipConns = new Map(), ipCreated = new Map();
let conns = 0;

// Identidad: "token" es secreto (solo lo conoce su dueño); "id" es público y es el que usan las salas y los juegos.
const rnd = n => crypto.randomBytes(n).toString('hex');
const mk = (name, role) => { const p = { id: rnd(4), token: rnd(16), name, role, sid: null, off: null, room: null }; players.set(p.id, p); tokens.set(p.token, p.id); return p; };
const emitTo = (p, ev, d) => { const s = p && p.sid && io.sockets.sockets.get(p.sid); if (s) s.emit(ev, d); };
const code = () => { let c; do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (c.length < 4 || rooms.has(c)); return c; };

const info = r => ({ id: r.id, game: r.game, gameName: cfg.games[r.game].name, players: r.players.map(p => p.name), ids: r.players.map(p => p.id),
  online: r.players.map(p => !players.get(p.id)?.off), min: cfg.games[r.game].min, max: cfg.games[r.game].max,
  status: r.status, host: r.host, paused: r.paused, boardOn: r.board ? !players.get(r.board)?.off : null });
const publicRooms = () => [...rooms.values()].filter(r => r.isPublic && r.status === 'waiting').map(info);
const lobby = () => io.emit('lobby', publicRooms());

// Cada jugador recibe su estado privado; el tablero solo el público (getState(null)).
function push(r) {
  r.last = Date.now();
  const st = id => (r.status === 'waiting' ? null : r.impl.getState(id));
  for (const p of r.players) emitTo(players.get(p.id), 'room', { ...info(r), you: p.id, mode: r.board ? 'phone' : 'both', state: st(p.id) });
  if (r.board) emitTo(players.get(r.board), 'room', { ...info(r), you: null, mode: 'board', state: st(null) });
}

function leaveRoom(p) {
  const r = rooms.get(p.room);
  p.room = null;
  if (!r) return;
  if (r.board === p.id) return closeRoom(r.id, 'Se cerró el tablero.');
  r.players = r.players.filter(x => x.id !== p.id);
  if (r.status === 'playing') { r.impl.onLeave(p.id); if (r.impl.finished) r.status = 'finished'; }
  if (!r.players.length && !r.board) rooms.delete(r.id);
  else { if (r.host === p.id) r.host = r.players[0]?.id ?? null; push(r); }
  lobby();
}

function closeRoom(id, msg) {
  const r = rooms.get(id);
  if (!r) return;
  rooms.delete(id);
  for (const pid of [...r.players.map(x => x.id), r.board]) {
    const p = players.get(pid);
    if (p) { p.room = null; emitTo(p, 'kicked', msg); }
  }
  lobby();
}

function dropPlayer(p) { leaveRoom(p); players.delete(p.id); tokens.delete(p.token); }

io.on('connection', s => {
  const ip = s.handshake.address;
  if (conns >= G.maxConnections || (ipConns.get(ip) || 0) >= G.maxConnectionsPerIp) {
    s.emit('err', 'El servidor está lleno. Probá de nuevo en unos minutos.');
    return s.disconnect(true);
  }
  conns++; ipConns.set(ip, (ipConns.get(ip) || 0) + 1);
  s.p = null;

  let n = 0, t = Date.now();
  s.use((_, next) => {
    const now = Date.now();
    if (now - t > 1000) { t = now; n = 0; }
    next(++n > G.msgsPerSecond ? new Error('Demasiados mensajes seguidos.') : undefined);
  });
  s.on('error', e => s.emit('err', e.message));
  const fail = m => s.emit('err', m);
  const me = () => (s.p && s.p.sid === s.id ? s.p : null);
  const on = (ev, fn) => s.on(ev, d => { const p = me(); if (!p) return fail('Primero ingresá tu nombre.'); fn(p, d || {}); });

  s.emit('games', Object.entries(cfg.games).map(([id, g]) => ({ id, ...g })));
  s.emit('lobby', publicRooms());

  // Ingreso o reanudación de sesión (por token).
  s.on('hello', d => {
    d = d || {};
    let p = tokens.has(d.token) ? players.get(tokens.get(d.token)) : null;
    if (!p) {
      if (d.role === 'board') p = mk('Tablero', 'board');
      else {
        if (!d.name) return s.emit('needName');
        const name = String(d.name).replace(/[<>]/g, '').trim().slice(0, 20);
        if (name.length < 2) { s.emit('needName'); return fail('Ingresá un nombre de al menos 2 letras.'); }
        if ([...players.values()].some(x => x.role !== 'board' && x.name.toLowerCase() === name.toLowerCase())) {
          s.emit('needName'); return fail('Ese nombre ya está en uso. Elegí otro.');
        }
        p = mk(name, 'player');
      }
    }
    const old = p.sid && io.sockets.sockets.get(p.sid);
    if (old && old.id !== s.id) { old.emit('taken'); old.disconnect(true); } // la conexión nueva toma el control
    p.sid = s.id; p.off = null; s.p = p;
    s.emit('session', { token: p.token, name: p.name, role: p.role });
    const r = rooms.get(p.room);
    if (r) push(r);
  });

  on('create', (p, d) => {
    if (p.room) return fail('Ya estás en una sala.');
    if (!Object.hasOwn(cfg.games, d.game)) return fail('Juego desconocido.');
    const isBoard = p.role === 'board';
    if (isBoard && !cfg.games[d.game].board) return fail('Este juego todavía no tiene modo tablero.');
    if (rooms.size >= G.maxRooms) return fail('Hay demasiadas salas abiertas. Probá más tarde.');
    const now = Date.now(), recent = (ipCreated.get(ip) || []).filter(x => now - x < 3600e3);
    if (recent.length >= G.maxRoomsPerHour) return fail('Creaste muchas salas. Esperá un rato.');
    ipCreated.set(ip, [...recent, now]);
    const opts = d.opts && typeof d.opts === 'object' ? d.opts : {};
    const r = { id: code(), game: d.game, host: isBoard ? null : p.id, board: isBoard ? p.id : null,
      players: isBoard ? [] : [{ id: p.id, name: p.name }], status: 'waiting', isPublic: !isBoard && d.isPublic !== false,
      opts, round: 0, impl: new GAMES[d.game](opts), last: now, paused: false };
    rooms.set(r.id, r); p.room = r.id; push(r); lobby();
  });

  on('join', (p, d) => {
    if (p.role === 'board') return fail('Un tablero no puede unirse como jugador.');
    if (p.room) return fail('Ya estás en una sala.');
    const r = rooms.get(String(d.id || '').trim().toUpperCase());
    if (!r) return fail('No existe una sala con ese código.');
    if (r.status !== 'waiting') return fail('La partida ya empezó.');
    if (r.players.length >= cfg.games[r.game].max) return fail('La sala está llena.');
    r.players.push({ id: p.id, name: p.name }); p.room = r.id; if (!r.host) r.host = p.id;
    push(r); lobby();
  });

  on('start', (p) => {
    const r = rooms.get(p.room);
    if (!r || (r.host !== p.id && r.board !== p.id) || r.status === 'playing') return;
    if (r.paused) return fail('La sala está en pausa.');
    if (r.players.length < cfg.games[r.game].min) return fail('Faltan jugadores para empezar.');
    r.impl = new GAMES[r.game](r.opts); r.impl.start(r.players.map(x => x.id), r.round++);
    r.status = 'playing'; push(r); lobby();
  });

  on('move', (p, d) => {
    const r = rooms.get(p.room);
    if (!r || r.status !== 'playing' || p.role === 'board') return;
    if (r.paused) return fail('La partida está en pausa.');
    const err = r.impl.onMove(p.id, d);
    if (err) return fail(err);
    if (r.impl.finished) r.status = 'finished';
    push(r);
  });

  // Pausa: congela jugadas, el cierre por inactividad y la expulsión por desconexión.
  on('pause', p => {
    const r = rooms.get(p.room);
    if (!r) return;
    r.paused = !r.paused;
    if (!r.paused) for (const pid of [...r.players.map(x => x.id), r.board]) { const q = players.get(pid); if (q && q.off) q.off = Date.now(); }
    push(r);
  });

  on('leave', p => leaveRoom(p));
  on('bye', p => dropPlayer(p));

  s.on('disconnect', () => {
    conns--;
    const c = (ipConns.get(ip) || 1) - 1;
    c ? ipConns.set(ip, c) : ipConns.delete(ip);
    const p = me();
    if (p) { p.sid = null; p.off = Date.now(); const r = rooms.get(p.room); if (r) push(r); }
  });
});

// Margen de reconexión vencido e inactividad (ambos se suspenden en pausa).
setInterval(() => {
  const now = Date.now();
  for (const p of [...players.values()]) {
    const r = rooms.get(p.room);
    if (p.off && now - p.off > GRACE && !(r && r.paused)) dropPlayer(p);
  }
  for (const r of [...rooms.values()])
    if (!r.paused && now - r.last > G.roomIdleMinutes * 60e3) closeRoom(r.id, 'La sala se cerró por inactividad.');
}, 5e3);

// QR para unirse y panel de administración.
app.get('/qr', async (q, res) => res.type('svg').send(await QR.toString(String(q.query.t || '').slice(0, 200), { type: 'svg', margin: 1 })));
const auth = (q, res, next) => (q.get('x-admin-token') === cfg.adminToken ? next() : res.sendStatus(401));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (q, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin/api/stats', auth, (q, res) => res.json({
  connections: conns, memoryMB: Math.round(process.memoryUsage().rss / 1048576), limits: G,
  rooms: [...rooms.values()].map(r => ({ ...info(r), idleSec: Math.round((Date.now() - r.last) / 1000) }))
}));
app.post('/admin/api/close/:id', auth, (q, res) => { closeRoom(q.params.id, 'Un administrador cerró la sala.'); res.sendStatus(200); });

server.listen(cfg.port, () => {
  console.log(`Plataforma lista en http://localhost:${cfg.port}`);
  if (cfg.adminToken === 'cambiar-esto') console.warn('Definí la variable ADMIN_TOKEN antes de publicar el servidor.');
});
