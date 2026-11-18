// Interfaz común de los juegos: start(ids), onMove(id, data) -> error|undefined,
// onLeave(id), getState(id), finished.
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

module.exports = class TaTeTi {
  constructor() {
    this.players = []; this.board = Array(9).fill(null);
    this.turn = 0; this.winner = null; this.draw = false;
  }
  start(ids) { this.players = ids.slice(0, 2); }
  get finished() { return this.winner !== null || this.draw; }
  onMove(id, { cell }) {
    if (this.finished) return 'La partida ya terminó.';
    if (this.players[this.turn] !== id) return 'No es tu turno.';
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || this.board[cell]) return 'Esa casilla no está disponible.';
    this.board[cell] = this.turn === 0 ? 'X' : 'O';
    if (LINES.some(l => l.every(i => this.board[i] === this.board[cell]))) this.winner = id;
    else if (this.board.every(Boolean)) this.draw = true;
    else this.turn = 1 - this.turn;
  }
  onLeave(id) { if (!this.finished) this.winner = this.players.find(p => p !== id) ?? null; }
  getState(id) {
    return { board: this.board, turn: this.players[this.turn], winner: this.winner, draw: this.draw,
             you: this.players.indexOf(id) === 0 ? 'X' : 'O' };
  }
};
