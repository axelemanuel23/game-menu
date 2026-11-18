const Base = require('./base');
const MAX = 6;

// Modo "grupo": una persona elige la palabra y los demás adivinan por turnos.
// Modo "duelo": cada jugador elige su palabra y adivina la del rival.
module.exports = class Ahorcado extends Base {
  constructor(o = {}) {
    super();
    this.mode = o.modo === 'duelo' ? 'duelo' : 'grupo';
    if (this.mode === 'duelo') this.max = 2;
    this.T = {}; this.turn = 0; this.result = null; this.winner = null;
  }
  check(n) { return this.mode === 'duelo' && n !== 2 ? 'El duelo es de 2 jugadores.' : null; }
  start(ids, round = 0) {
    const grupo = this.mode === 'grupo';
    this.ids = ids;
    this.setter = grupo ? ids[round % ids.length] : null; // en grupo, quien elige la palabra rota
    this.owners = grupo ? [this.setter] : ids;
    this.order = grupo ? ids.filter(i => i !== this.setter) : ids;
    this.owners.forEach(o => (this.T[o] = { owner: o, word: null, tried: [], wrong: 0 }));
  }
  get phase() { return this.owners.every(o => this.T[o].word) ? 'guess' : 'word'; }
  target(id) { return this.mode === 'grupo' ? this.T[this.setter] : this.T[this.ids.find(i => i !== id)]; }
  end(result, winner) { this.over = true; this.result = result; this.winner = winner; }
  onMove(id, d) {
    if (this.over) return 'La partida ya terminó.';
    if (this.phase === 'word') {
      const t = this.T[id];
      if (!t) return 'Esperá a que se elija la palabra.';
      if (t.word) return 'Ya elegiste tu palabra.';
      const w = String(d.word || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!/^[A-Z]{3,20}$/.test(w)) return 'Usá entre 3 y 20 letras, sin espacios ni números.';
      t.word = w; return;
    }
    if (this.order[this.turn] !== id) return 'No es tu turno.';
    const t = this.target(id), l = String(d.letter || '').toUpperCase();
    if (!/^[A-Z]$/.test(l) || t.tried.includes(l)) return 'Esa letra no está disponible.';
    t.tried.push(l);
    if (!t.word.includes(l)) t.wrong++;
    if ([...t.word].every(c => t.tried.includes(c))) this.end('guessers', this.mode === 'grupo' ? null : id);
    else if (t.wrong >= MAX) this.end('setter', this.mode === 'grupo' ? null : t.owner);
    else this.turn = (this.turn + 1) % this.order.length;
  }
  getState(id) {
    const cur = this.phase === 'guess' && !this.over ? this.target(this.order[this.turn]) : null;
    return { mode: this.mode, phase: this.phase, setter: this.setter, turn: this.order[this.turn], max: MAX, over: this.over,
      needWord: !!(id && this.T[id] && !this.T[id].word), turnTried: cur ? cur.tried : [], result: this.result, winner: this.winner, abandoned: this.abandoned,
      targets: this.owners.map(o => {
        const t = this.T[o];
        return { owner: o, wrong: t.wrong, tried: t.tried, masked: t.word ? [...t.word].map(c => (t.tried.includes(c) ? c : '_')) : [],
          word: t.word && (o === id || this.over) ? t.word : null };
      }) };
  }
};
