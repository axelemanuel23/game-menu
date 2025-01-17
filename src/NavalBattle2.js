import React, { useRef, useState, useEffect } from 'react';
import { Ship, Crosshair } from 'lucide-react';

const NavalBattle = () => {
  const [fase, setFase] = useState('colocacion'); // 'colocacion' o 'disparos'
  const [tableros, setTableros] = useState([
    Array(5).fill().map(() => Array(5).fill(0)),
    Array(5).fill().map(() => Array(5).fill(0))
  ]);
  const [barcos, setBarcos] = useState([null, null]);
  const [intentos, setIntentos] = useState([0, 0]);
  const [barcosHundidos, setBarcosHundidos] = useState([false, false]);
  const [jugadorActual, setJugadorActual] = useState(0);
  const [ganador, setGanador] = useState(null);
  const socket = useRef(null);

  useEffect(() => {
    socket.current = new WebSocket('ws://localhost:8080');

    socket.current.onmessage = (message) => {
      const data = JSON.parse(message.data);
      switch (data.type) {
        case 'update':
          setTableros(data.state.tableros);
          setBarcos(data.state.jugadores);
          setIntentos(data.state.intentos);
          setBarcosHundidos(data.state.barcosHundidos);
          setJugadorActual(data.state.jugadorActual);
          setGanador(data.state.ganador);
          if (data.state.jugadores[0] !== null && data.state.jugadores[1] !== null) {
            setFase('disparos');
          }
          break;
        case 'init':
          setTableros(data.state.tableros);
          setBarcos(data.state.jugadores);
          setIntentos(data.state.intentos);
          setBarcosHundidos(data.state.barcosHundidos);
          setJugadorActual(data.state.jugadorActual);
          setGanador(data.state.ganador);
          break;
        default:
          break;
      }
    };

    return () => {
      socket.current.close();
    };
  }, []);

  const colocarBarco = (x, y) => {
    if (barcos[jugadorActual] !== null) return;

    socket.current.send(JSON.stringify({ type: 'colocarBarco', x, y, jugador: jugadorActual }));
  };

  const disparo = (x, y) => {
    if (ganador !== null) return;
    socket.current.send(JSON.stringify({ type: 'disparo', x, y, jugador: jugadorActual }));
  };

  const renderTablero = (jugador) => (
    <div className="grid grid-cols-5 gap-1 mb-4">
      {tableros[jugador].map((fila, y) =>
        fila.map((celda, x) => (
          <button
            key={`${jugador}-${x}-${y}`}
            onClick={() => fase === 'colocacion' ? colocarBarco(x, y) : (jugador !== jugadorActual && disparo(x, y))}
            className={`w-10 h-10 flex items-center justify-center border ${
              fase === 'colocacion' ? 'bg-blue-200' :
              celda === 0 ? 'bg-blue-300' :
              celda === 1 ? 'bg-gray-400' : 'bg-red-500'
            }`}
            disabled={(fase === 'disparos' && (jugador === jugadorActual || celda !== 0)) || ganador !== null}
          >
            {fase === 'colocacion' && jugador === jugadorActual && barcos[jugador]?.x === x && barcos[jugador]?.y === y && <Ship className="text-blue-600" size={20} />}
            {fase === 'disparos' && celda === 1 && <Crosshair className="text-white" size={20} />}
            {fase === 'disparos' && celda === 2 && <Ship className="text-white" size={20} />}
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Batalla Naval - 2 Jugadores</h1>
      {fase === 'colocacion' ? (
        <div className="text-2xl font-bold mb-4 text-blue-600">
          Jugador {jugadorActual + 1}, coloca tu barco
        </div>
      ) : ganador === null ? (
        <div className="text-2xl font-bold mb-4 text-blue-600">
          Turno del Jugador {jugadorActual + 1}
        </div>
      ) : (
        <div className="text-2xl font-bold mb-4 text-green-600">
          ¡El Jugador {ganador + 1} ha ganado!
        </div>
      )}
      <div className="flex justify-center gap-8">
        {[0, 1].map(jugador => (
          <div key={jugador} className="flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2">Tablero del Jugador {jugador + 1}</h2>
            {renderTablero(jugador)}
            {fase === 'disparos' && (
              <>
                <p>Intentos: {intentos[jugador]}</p>
                <p>Barco: {barcosHundidos[jugador] ? 'Hundido' : 'A flote'}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NavalBattle;
