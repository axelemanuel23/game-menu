import React, { useRef, useState, useEffect } from 'react';
import { Ship, Crosshair } from 'lucide-react';

const NavalBattle = () => {
  const [fase, setFase] = useState('espera'); // 'espera', 'colocacion' o 'disparos'
  const [miTablero, setMiTablero] = useState(Array(5).fill().map(() => Array(5).fill(0)));
  const [tableroOponente, setTableroOponente] = useState(Array(5).fill().map(() => Array(5).fill(0)));
  const [misBarcos, setMisBarcos] = useState([]);
  const [misIntentos, setMisIntentos] = useState(0);
  const [misBarcosHundidos, setMisBarcosHundidos] = useState(0);
  const [barcosOponenteHundidos, setBarcosOponenteHundidos] = useState(0);
  const [miId, setMiId] = useState(null);
  const [ganador, setGanador] = useState(null);
  const [esMiTurno, setEsMiTurno] = useState(false);
  const socket = useRef(null);

  useEffect(() => {
    socket.current = new WebSocket('ws://multiplayer-game-ucym.onrender.com');

    socket.current.onmessage = (message) => {
      const data = JSON.parse(message.data);
      switch (data.type) {
        case 'update':
          if (data.state) {
            setMiTablero(data.state.miTablero || Array(5).fill().map(() => Array(5).fill(0)));
            setTableroOponente(data.state.tableroOponente || Array(5).fill().map(() => Array(5).fill(0)));
            setMisBarcos(data.state.misBarcos || []);
            setMisIntentos(data.state.misIntentos || 0);
            setMisBarcosHundidos(data.state.misBarcosHundidos || 0);
            setBarcosOponenteHundidos(data.state.barcosOponenteHundidos || 0);
            setGanador(data.state.ganador);
            setFase(data.state.fase || 'espera');
            setEsMiTurno(data.state.esMiTurno || false);
          }
          break;
        case 'init':
          if (data.state) {
            setMiId(data.state.miId);
          }
          break;
        case 'error':
          alert(data.message);
          break;
        default:
          break;
      }
    };

    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, []);

  const colocarBarco = (x, y) => {
    if (!socket.current || misBarcos.length >= 3) return;
    socket.current.send(JSON.stringify({ type: 'colocarBarco', x, y }));
  };

  const disparo = (x, y) => {
    if (!socket.current || fase !== 'disparos' || ganador !== null || !esMiTurno) return;
    // Solo verificamos si es agua (1), permitimos disparar si es un barco (2) que no está hundido
    if (tableroOponente[y][x] === 1) {
      alert('Ya disparaste en esa posición');
      return;
    }
    socket.current.send(JSON.stringify({ type: 'disparo', x, y }));
  };

  const renderTablero = (esTableroPropio) => {
    const tablero = esTableroPropio ? miTablero : tableroOponente;
    if (!tablero || !Array.isArray(tablero)) return null;

    return (
      <div className="grid grid-cols-5 gap-1 mb-4">
        {tablero.map((fila, y) =>
          Array.isArray(fila) && fila.map((celda, x) => (
            <button
              key={`${x}-${y}`}
              onClick={() => esTableroPropio ? colocarBarco(x, y) : disparo(x, y)}
              className={`w-10 h-10 flex items-center justify-center border ${
                fase === 'colocacion' ? 'bg-blue-200' :
                celda === 0 ? 'bg-blue-300' :
                celda === 1 ? 'bg-gray-400' : 
                esTableroPropio ? 'bg-blue-600' : 'bg-red-500'
              }`}
              disabled={
                ganador !== null || 
                (fase === 'colocacion' && !esTableroPropio) ||
                (fase === 'disparos' && (esTableroPropio || !esMiTurno))
              }
            >
              {fase === 'colocacion' && esTableroPropio && misBarcos.some(barco => barco.x === x && barco.y === y) && 
                <Ship className="text-blue-600" size={20} />}
              {fase === 'disparos' && celda === 1 && <Crosshair className="text-white" size={20} />}
              {fase === 'disparos' && celda === 2 && <Ship className="text-white" size={20} />}
            </button>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Batalla Naval</h1>
      {fase === 'espera' ? (
        <div className="text-2xl font-bold mb-4 text-blue-600">
          Esperando a otro jugador...
        </div>
      ) : fase === 'colocacion' ? (
        <div className="text-2xl font-bold mb-4 text-blue-600">
          {misBarcos.length < 3 ? `Coloca tu barco ${misBarcos.length + 1}/3` : 'Esperando al oponente'}
        </div>
      ) : ganador === null ? (
        <div className="text-2xl font-bold mb-4 text-blue-600">
          {esMiTurno ? 'Tu turno' : 'Esperando al oponente'}
        </div>
      ) : (
        <div className="text-2xl font-bold mb-4 text-green-600">
          ¡Has {ganador === miId ? 'ganado' : 'perdido'}!
        </div>
      )}
      <div className="flex gap-8">
        <div>
          <h2 className="text-xl font-bold mb-2">Tu tablero</h2>
          {renderTablero(true)}
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Tablero oponente</h2>
          {renderTablero(false)}
        </div>
      </div>
      {fase === 'disparos' && miId !== null && (
        <>
          <p>Tus intentos: {misIntentos}</p>
          <p>Barcos hundidos: {misBarcosHundidos}/3</p>
          <p>Barcos del oponente hundidos: {barcosOponenteHundidos}/3</p>
        </>
      )}
    </div>
  );
};

export default NavalBattle;
