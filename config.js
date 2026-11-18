// Todos los límites y juegos se ajustan acá, sin tocar el resto del código.
module.exports = {
  port: process.env.PORT || 3000,
  adminToken: process.env.ADMIN_TOKEN || 'cambiar-esto',
  global: {
    maxRooms: 100,           // salas abiertas a la vez
    maxConnections: 500,     // conexiones totales
    maxConnectionsPerIp: 10, // conexiones por IP
    maxRoomsPerHour: 10,     // salas creadas por IP en una hora
    msgsPerSecond: 10,       // mensajes por segundo por conexión
    roomIdleMinutes: 5       // se cierra la sala sin actividad
  },
  // Para sumar un juego: crear games/<id>.js, registrarlo en server.js y agregarlo acá.
  games: {
    tateti: { name: 'Ta-Te-Ti', desc: 'Tres en línea, por turnos.', min: 2, max: 2 },
    adivina: { name: 'Adivina mi número', desc: 'Descubrí el número secreto de tu rival con pistas.', min: 2, max: 2 },
    ahorcado: { name: 'Ahorcado', desc: 'Uno elige la palabra y los demás adivinan letra por letra.', min: 2, max: 8 },
    naval: { name: 'Batalla naval', desc: 'Hundí la flota de tu rival antes de que hunda la tuya.', min: 2, max: 2 },
    desconfio: { name: 'Desconfío', desc: 'Juego de cartas de engaño: tirá cartas y desconfiá del rival.', min: 2, max: 6 }
  }
};
