// Base común: estado "terminada" y abandono de un jugador.
module.exports = class Base {
  constructor() { this.over = false; this.abandoned = false; }
  get finished() { return this.over; }
  onLeave() { if (!this.over) { this.over = true; this.abandoned = true; } }
};
