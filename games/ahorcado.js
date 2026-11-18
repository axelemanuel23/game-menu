const Base = require('./base');
const MAX = 6;

module.exports = class Ahorcado extends Base {
  constructor() { super(); this.word = null; this.tried = []; this.wrong = 0; this.turn = 0; this.result = null; }
  // Quien elige la palabra rota en cada partida (round).
  start(ids, round = 0) { this.setter = ids[round % ids.length]; this.guessers = ids.filter(i => i !== this.setter); }
  onMove(id, d) {
    if (this.over) return 'La partida ya terminó.';
    if (!this.word) {
      if (id !== this.setter) return 'Esperá a que se elija la palabra.';
      const w = String(d.word || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!/^[A-Z]{3,20}$/.test(w)) return 'Usá entre 3 y 20 letras, sin espacios ni números.';
      this.word = w; return;
    }
    if (this.guessers[this.turn] !== id) return 'No es tu turno.';
    const l = String(d.letter || '').toUpperCase();
    if (!/^[A-Z]$/.test(l) || this.tried.includes(l)) return 'Esa letra no está disponible.';
    this.tried.push(l);
    if (!this.word.includes(l)) this.wrong++;
    if ([...this.word].every(c => this.tried.includes(c))) { this.result = 'guessers'; this.over = true; }
    else if (this.wrong >= MAX) { this.result = 'setter'; this.over = true; }
    else this.turn = (this.turn + 1) % this.guessers.length;
  }
  getState(id) {
    return { phase: this.word ? 'guess' : 'word', setter: this.setter, turn: this.guessers[this.turn], tried: this.tried,
      wrong: this.wrong, max: MAX, masked: this.word ? [...this.word].map(c => (this.tried.includes(c) ? c : '_')) : [],
      word: id === this.setter || this.over ? this.word : null, result: this.result, abandoned: this.abandoned };
  }
};
