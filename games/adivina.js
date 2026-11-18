const Base = require('./base');

module.exports = class Adivina extends Base {
  constructor(o = {}) {
    super();
    const n = parseInt(o.digits, 10);
    this.n = n >= 3 && n <= 10 ? n : 4;
    this.sec = {}; this.log = []; this.turn = 0; this.winner = null;
  }
  start(ids) { this.ids = ids.slice(0, 2); }
  ok(v) { return typeof v === 'string' && v.length === this.n && /^\d+$/.test(v) && new Set(v).size === this.n; }
  get phase() { return this.ids.every(i => this.sec[i]) ? 'play' : 'secret'; }
  onMove(id, d) {
    if (this.over) return 'La partida ya terminó.';
    if (this.phase === 'secret') {
      if (this.sec[id]) return 'Ya elegiste tu número.';
      if (!this.ok(d.secret)) return `Elegí ${this.n} cifras sin repetir dígitos.`;
      this.sec[id] = d.secret; return;
    }
    if (this.ids[this.turn] !== id) return 'No es tu turno.';
    if (!this.ok(d.guess)) return `Ingresá ${this.n} cifras sin repetir dígitos.`;
    const s = this.sec[this.ids.find(x => x !== id)];
    const known = [...d.guess].filter(c => s.includes(c)).length;
    const exact = [...d.guess].filter((c, i) => s[i] === c).length;
    this.log.push({ by: id, guess: d.guess, known, exact });
    if (exact === this.n) { this.winner = id; this.over = true; } else this.turn = 1 - this.turn;
  }
  getState(id) {
    const opp = this.ids.find(x => x !== id);
    return { n: this.n, phase: this.phase, mySecret: this.sec[id] || null, turn: this.ids[this.turn], winner: this.winner,
      abandoned: this.abandoned, log: this.log.map(e => ({ by: e.by, mine: e.by === id, guess: e.guess, known: e.known, exact: e.exact })),
      oppSecret: this.over && !this.abandoned ? this.sec[opp] || null : null,
      secrets: this.over && !this.abandoned ? this.sec : null };
  }
};
