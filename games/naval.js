const Base = require('./base');
const N = 10, FLEET = [5, 4, 3, 3, 2];

function randomFleet() {
  for (;;) {
    const used = new Set(), ships = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const h = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (h ? N : N - len + 1)), c = Math.floor(Math.random() * (h ? N - len + 1 : N));
        const cells = Array.from({ length: len }, (_, i) => (h ? r * N + c + i : (r + i) * N + c));
        if (cells.every(x => !used.has(x))) { cells.forEach(x => used.add(x)); ships.push(cells); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}

function validFleet(sh) {
  if (!Array.isArray(sh) || sh.length !== FLEET.length) return false;
  if (sh.map(s => (Array.isArray(s) ? s.length : 0)).sort().join() !== [...FLEET].sort().join()) return false;
  const used = new Set();
  for (const s of sh) {
    if (!s.every(c => Number.isInteger(c) && c >= 0 && c < 100)) return false;
    const h = s.every((c, i) => c === s[0] + i && Math.floor(c / N) === Math.floor(s[0] / N));
    if (!h && !s.every((c, i) => c === s[0] + i * N)) return false;
    for (const c of s) { if (used.has(c)) return false; used.add(c); }
  }
  return true;
}

module.exports = class Naval extends Base {
  constructor() { super(); this.P = {}; this.phase = 'place'; this.turn = 0; this.winner = null; this.last = null; }
  start(ids) {
    this.ids = ids.slice(0, 2);
    for (const id of this.ids) this.P[id] = { ships: randomFleet(), shots: new Set(), ready: false };
  }
  opp(id) { return this.ids.find(x => x !== id); }
  onMove(id, d) {
    const p = this.P[id];
    if (!p || this.over) return 'La partida ya terminó.';
    if (this.phase === 'place') {
      if (p.ready) return 'Ya estás listo.';
      if (d.random) { p.ships = randomFleet(); return; }
      if (d.ships) { if (!validFleet(d.ships)) return 'Esa ubicación de la flota no es válida.'; p.ships = d.ships.map(s => s.slice()); return; }
      if (d.ready) { p.ready = true; if (this.ids.every(i => this.P[i].ready)) this.phase = 'play'; return; }
      return 'Movimiento inválido.';
    }
    if (this.ids[this.turn] !== id) return 'No es tu turno.';
    const q = this.P[this.opp(id)], c = d.cell;
    if (!Number.isInteger(c) || c < 0 || c > 99 || q.shots.has(c)) return 'Ya disparaste en esa casilla.';
    q.shots.add(c);
    const ship = q.ships.find(s => s.includes(c));
    const res = !ship ? 'agua' : ship.every(x => q.shots.has(x)) ? 'hundido' : 'tocado';
    this.last = { by: id, res };
    if (q.ships.every(s => s.every(x => q.shots.has(x)))) { this.winner = id; this.over = true; }
    else this.turn = 1 - this.turn;
  }
  getState(id) {
    if (!id) return { board: true, phase: this.phase, turn: this.ids[this.turn], winner: this.winner, abandoned: this.abandoned,
      ready: this.ids.map(i => this.P[i].ready), last: this.last && { by: this.last.by, res: this.last.res },
      grids: this.ids.map(i => { const P = this.P[i]; return { owner: i, left: P.ships.filter(s => !s.every(x => P.shots.has(x))).length,
        cells: Array.from({ length: 100 }, (_, c) => (!P.shots.has(c) ? '' : P.ships.some(x => x.includes(c)) ? 'X' : 'o')) }; }) };
    const me = this.P[id], q = this.P[this.opp(id)];
    const mine = Array.from({ length: 100 }, (_, i) => { const s = me.ships.some(x => x.includes(i)), h = me.shots.has(i); return s ? (h ? 'X' : 'S') : h ? 'o' : ''; });
    const theirs = Array.from({ length: 100 }, (_, i) => (!q.shots.has(i) ? '' : q.ships.some(x => x.includes(i)) ? 'X' : 'o'));
    return { phase: this.phase, ready: me.ready, ships: me.ships, mine, theirs, turn: this.ids[this.turn], winner: this.winner,
      last: this.last && { mine: this.last.by === id, res: this.last.res },
      left: q.ships.filter(s => !s.every(x => q.shots.has(x))).length, abandoned: this.abandoned };
  }
};
