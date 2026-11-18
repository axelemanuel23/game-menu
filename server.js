const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cfg = require('./config');
const GAMES = {
  tateti: require('./games/tateti'), adivina: require('./games/adivina'), ahorcado: require('./games/ahorcado'),
  naval: require('./games/naval'), desconfio: require('./games/desconfio')
};

const G = cfg.global;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e4 });
const rooms = new Map(), ipConns = new Map(), ipCreated = new Map();
let conns = 0;

const code = () => { let c; do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (c.length < 4 || rooms.has(c)); return c; };
const info = r => ({ id: r.id, game: r.game, gameName: cfg.games[r.game].name, players: r.players.map(p => p.name),
  min: cfg.games[r.game].min, max: cfg.games[r.game].max, status: r.status, host: r.host });
const publicRooms = () => [...rooms.values()].filter(r => r.isPublic && r.status === 'waiting').map(info);
const lobby = () => io.emit('lobby', publicRooms());

// Cada jugador recibe solo el estado que le corresponde ver.
function push(r) {
  r.last = Date.now();
  for (const p of r.players)
    io.to(p.id).emit('room', { ...info(r), ids: r.players.map(x => x.id), you: p.id, state: r.status === 'waiting' ? null : r.impl.getState(p.id) });
}

function detach(s) {
  const r = rooms.get(s.roomId);
  s.roomId = null;
  if (!r) return;
  s.leave(r.id);
  r.players = r.players.filter(p => p.id !== s.id);
  if (r.status === 'playing') { r.impl.onLeave(s.id); if (r.impl.finished) r.status = 'finished'; }
  if (!r.players.length) rooms.delete(r.id);
  else { if (r.host === s.id) r.host = r.players[0].id; push(r); }
  lobby();
}

function closeRoom(id, msg) {
  const r = rooms.get(id);
  if (!r) return;
  rooms.delete(id);
  for (const p of r.players) {
    const s = io.sockets.sockets.get(p.id);
    if (s) { s.leave(id); s.roomId = null; s.emit('kicked', msg); }
  }
  lobby();
}

io.on('connection', s => {
  const ip = s.handshake.address;
  if (conns >= G.maxConnections || (ipConns.get(ip) || 0) >= G.maxConnectionsPerIp) {
    s.emit('err', 'El servidor está lleno. Probá de nuevo en unos minutos.');
    return s.disconnect(true);
  }
  conns++; ipConns.set(ip, (ipConns.get(ip) || 0) + 1);
  s.roomId = null;

  let n = 0, t = Date.now();
  s.use((_, next) => {
    const now = Date.now();
    if (now - t > 1000) { t = now; n = 0; }
    next(++n > G.msgsPerSecond ? new Error('Demasiados mensajes seguidos.') : undefined);
  });
  s.on('error', e => s.emit('err', e.message));

  const fail = m => s.emit('err', m);
  const clean = v => String(v || '').replace(/[<>]/g, '').trim().slice(0, 20) || 'Jugador';
  s.emit('games', Object.entries(cfg.games).map(([id, g]) => ({ id, ...g })));
  s.emit('lobby', publicRooms());

  s.on('create', d => {
    d = d || {};
    if (s.roomId) return fail('Ya estás en una sala.');
    if (!Object.hasOwn(cfg.games, d.game)) return fail('Juego desconocido.');
    if (rooms.size >= G.maxRooms) return fail('Hay demasiadas salas abiertas. Probá más tarde.');
    const now = Date.now(), recent = (ipCreated.get(ip) || []).filter(x => now - x < 3600e3);
    if (recent.length >= G.maxRoomsPerHour) return fail('Creaste muchas salas. Esperá un rato.');
    ipCreated.set(ip, [...recent, now]);
    const opts = d.opts && typeof d.opts === 'object' ? d.opts : {};
    const r = { id: code(), game: d.game, host: s.id, players: [{ id: s.id, name: clean(d.name) }],
      status: 'waiting', isPublic: d.isPublic !== false, opts, round: 0, impl: new GAMES[d.game](opts), last: now };
    rooms.set(r.id, r); s.join(r.id); s.roomId = r.id; push(r); lobby();
  });

  s.on('join', d => {
    d = d || {};
    if (s.roomId) return fail('Ya estás en una sala.');
    const r = rooms.get(String(d.id || '').trim().toUpperCase());
    if (!r) return fail('No existe una sala con ese código.');
    if (r.status !== 'waiting') return fail('La partida ya empezó.');
    if (r.players.length >= cfg.games[r.game].max) return fail('La sala está llena.');
    r.players.push({ id: s.id, name: clean(d.name) }); s.join(r.id); s.roomId = r.id; push(r); lobby();
  });

  s.on('start', () => {
    const r = rooms.get(s.roomId);
    if (!r || r.host !== s.id || r.status === 'playing') return;
    if (r.players.length < cfg.games[r.game].min) return fail('Faltan jugadores para empezar.');
    r.impl = new GAMES[r.game](r.opts); r.impl.start(r.players.map(p => p.id), r.round++);
    r.status = 'playing'; push(r); lobby();
  });

  s.on('move', d => {
    const r = rooms.get(s.roomId);
    if (!r || r.status !== 'playing') return;
    const err = r.impl.onMove(s.id, d || {});
    if (err) return fail(err);
    if (r.impl.finished) r.status = 'finished';
    push(r);
  });

  s.on('leave', () => detach(s));
  s.on('disconnect', () => {
    detach(s); conns--;
    const c = (ipConns.get(ip) || 1) - 1;
    c ? ipConns.set(ip, c) : ipConns.delete(ip);
  });
});

// Cierre automático de salas inactivas.
setInterval(() => {
  const now = Date.now();
  for (const r of [...rooms.values()])
    if (now - r.last > G.roomIdleMinutes * 60e3) closeRoom(r.id, 'La sala se cerró por inactividad.');
}, 30e3);

// Panel de administración.
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
