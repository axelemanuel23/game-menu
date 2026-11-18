# Plataforma de juegos multijugador

Requisitos: Node.js 18 o superior.

    npm install
    ADMIN_TOKEN=unaclavesegura npm start

- Juegos: http://localhost:3000
- Panel de administración: http://localhost:3000/admin (pide el token)
- Límites y catálogo de juegos: `config.js`

## Agregar un juego
1. Crear `games/<id>.js` con la interfaz de `games/tateti.js` (`start`, `onMove`, `onLeave`, `getState`, `finished`).
2. Registrarlo en `GAMES` dentro de `server.js` y en `config.js`.
3. Agregar su vista en `VIEWS` dentro de `public/index.html`.
