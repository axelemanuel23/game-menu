const Base = require('./base');
const DECKS = {
  es: { suits: ['Oros', 'Copas', 'Espadas', 'Bastos'], vals: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] },
  po: { suits: ['Corazones', 'Diamantes', 'Tréboles', 'Picas'], vals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }
};

module.exports = class Desconfio extends Base {
  constructor(o = {}) {
    super();
    this.deck = DECKS[o.deck] ? o.deck : 'es';
    this.pile = []; this.last = null; this.suit = null; this.reveal = null; this.winner = null; this.phase = 'suit';
  }
  start(ids) {
    const D = DECKS[this.deck], cards = [];
    D.suits.forEach((_, s) => D.vals.forEach(v => cards.push({ id: s + '-' + v, s, v })));
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    this.ids = ids; this.hands = {};
    ids.forEach(i => (this.hands[i] = []));
    cards.forEach((c, i) => this.hands[ids[i % ids.length]].push(c));
    this.turn = Math.floor(Math.random() * ids.length); // la mano se sortea
  }
  get cur() { return this.ids[this.turn]; }
  get pending() { return !!this.last && this.hands[this.last.by].length === 0; }
  onMove(id, d) {
    if (this.over) return 'La partida ya terminó.';
    if (id !== this.cur) return 'No es tu turno.';
    const hand = this.hands[id];
    if (this.phase === 'suit') {
      if (!Number.isInteger(d.suit) || !hand.some(c => c.s === d.suit)) return 'Elegí un palo que tengas en la mano.';
      this.suit = d.suit; this.phase = 'play'; this.reveal = null; return;
    }
    if (d.doubt) {
      if (!this.last) return 'Todavía no hay una carta de la que desconfiar.';
      const liar = this.last.card.s !== this.suit, loser = liar ? this.last.by : id;
      this.reveal = { card: this.last.card, by: this.last.by, doubter: id, liar, loser };
      this.hands[loser].push(...this.pile); this.pile = []; this.last = null;
      const w = this.ids.find(i => this.hands[i].length === 0);
      if (w) { this.winner = w; this.over = true; return; }
      this.turn = this.ids.indexOf(loser); this.phase = 'suit'; this.suit = null; // quien perdió elige el palo
      return;
    }
    if (this.pending) { // el rival se quedó sin cartas: hay que desconfiar o aceptar
      if (d.pass) { this.winner = this.last.by; this.over = true; return; }
      return 'Podés desconfiar o aceptar la jugada.';
    }
    const i = hand.findIndex(c => c.id === d.card);
    if (i < 0) return 'Esa carta no está en tu mano.';
    const [card] = hand.splice(i, 1);
    this.pile.push(card); this.last = { by: id, card }; this.reveal = null;
    this.turn = (this.turn + 1) % this.ids.length;
  }
  getState(id) {
    return { deck: this.deck, suits: DECKS[this.deck].suits, phase: this.phase, turn: this.cur, suit: this.suit, pile: this.pile.length,
      hand: id ? [...this.hands[id]].sort((a, b) => a.s - b.s || a.v - b.v) : [], seats: this.ids.map(i => ({ id: i, n: this.hands[i].length })),
      lastBy: this.last && this.last.by, pending: this.pending, reveal: this.reveal, winner: this.winner, abandoned: this.abandoned };
  }
};
