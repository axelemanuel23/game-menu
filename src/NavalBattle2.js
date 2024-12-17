import React, { useState } from 'react';
import { Ship, Crosshair, Anchor } from 'lucide-react';

const NavalBattle = () => {
  const [fase, setFase] = useState('colocacion'); // 'colocacion' o 'disparos'
  const [tableros, setTableros] = useState([
    Array(5).fill().map(() => Array(5).fill(0)),
    Array(5).fill().map(() => Array(5).fill(0))
  ]);

  const TIPOS_BARCOS = [
    { nombre: 'Destructor', tamaño: 2 },
    { nombre: 'Crucero', tamaño: 3 },
    { nombre: 'Acorazado', tamaño: 4 }
  ];

  const [barcos, setBarcos] = useState([[], []]);  // Array de barcos para cada jugador
  const [barcoActual, setBarcoActual] = useState(0); // Índice del barco actual
  const [orientacion, setOrientacion] = useState('horizontal');
  const [intentos, setIntentos] = useState([0, 0]);
  const [barcosHundidos, setBarcosHundidos] = useState([false, false]);
  const [jugadorActual, setJugadorActual] = useState(0);
  const [ganador, setGanador] = useState(null);

   // Nuevo estado para drag and drop
   const [draggedShip, setDraggedShip] = useState(null);

   const onDragStart = (e, tipo) => {
     setDraggedShip(tipo);
     e.dataTransfer.setData('ship', JSON.stringify(tipo));
   };
 
   const onDragOver = (e) => {
     e.preventDefault();
   };
 
   const onDrop = (e, x, y) => {
     e.preventDefault();
     if (draggedShip && fase === 'colocacion') {
       colocarBarco(x, y);
     }
     setDraggedShip(null);
   };


  const puedeColocarBarco = (x, y, jugador, tipoBarco) => {
    if (orientacion === 'horizontal') {
      if (x + tipoBarco.tamaño > 8) return false;
      for (let i = 0; i < tipoBarco.tamaño; i++) {
        if (tableros[jugador][y][x + i] !== 0) return false;
      }
    } else {
      if (y + tipoBarco.tamaño > 8) return false;
      for (let i = 0; i < tipoBarco.tamaño; i++) {
        if (tableros[jugador][y + i][x] !== 0) return false;
      }
    }
    return true;
  };

  const colocarBarco = (x, y) => {
    if (barcoActual >= TIPOS_BARCOS.length) return;
    
    const tipoBarco = TIPOS_BARCOS[barcoActual];
    if (!puedeColocarBarco(x, y, jugadorActual, tipoBarco)) return;

    const nuevosTableros = [...tableros];
    const nuevosBarcos = [...barcos];
    
    // Colocar el barco en el tablero
    if (orientacion === 'horizontal') {
      for (let i = 0; i < tipoBarco.tamaño; i++) {
        nuevosTableros[jugadorActual][y][x + i] = 3; // 3 representa barco
      }
    } else {
      for (let i = 0; i < tipoBarco.tamaño; i++) {
        nuevosTableros[jugadorActual][y + i][x] = 3;
      }
    }

    // Guardar la información del barco
    nuevosBarcos[jugadorActual].push({
      tipo: tipoBarco,
      posiciones: orientacion === 'horizontal' 
        ? Array.from({length: tipoBarco.tamaño}, (_, i) => ({x: x + i, y}))
        : Array.from({length: tipoBarco.tamaño}, (_, i) => ({x, y: y + i})),
      impactos: 0
    });

    setTableros(nuevosTableros);
    setBarcos(nuevosBarcos);
    
    if (barcoActual === TIPOS_BARCOS.length - 1) {
      if (jugadorActual === 1) {
        setFase('disparos');
      } else {
        setJugadorActual(1);
        setBarcoActual(0);
      }
    } else {
      setBarcoActual(barcoActual + 1);
    }
  };

  const disparo = (x, y) => {
    if (ganador !== null) return;
    const oponente = 1 - jugadorActual;
    if (tableros[oponente][y][x] === 1 || tableros[oponente][y][x] === 2) return;

    const nuevosTableros = [...tableros];
    const nuevosBarcos = [...barcos];
    let impacto = false;

    // Verificar impacto en cualquier barco
    for (const barco of nuevosBarcos[oponente]) {
      const posicionImpactada = barco.posiciones.find(pos => pos.x === x && pos.y === y);
      if (posicionImpactada) {
        impacto = true;
        barco.impactos++;
        nuevosTableros[oponente][y][x] = 2; // Impacto
        
        // Verificar si el barco está hundido
        if (barco.impactos === barco.tipo.tamaño) {
          // Marcar todas las posiciones del barco como hundidas
          barco.posiciones.forEach(pos => {
            nuevosTableros[oponente][pos.y][pos.x] = 4; // 4 representa hundido
          });
        }
        break;
      }
    }

    if (!impacto) {
      nuevosTableros[oponente][y][x] = 1; // Agua
    }

    setTableros(nuevosTableros);
    setBarcos(nuevosBarcos);

    // Verificar victoria (todos los barcos hundidos)
    const todosHundidos = nuevosBarcos[oponente].every(barco => 
      barco.impactos === barco.tipo.tamaño
    );
    
    if (todosHundidos) {
      setGanador(jugadorActual);
    } else {
      setJugadorActual(oponente);
    }
  };

   // Modificación del renderTablero para incluir drag & drop y corregir visualización
   const renderTablero = (jugador) => (
    <div className="grid grid-cols-5 gap-1 mb-4">
      {tableros[jugador].map((fila, y) =>
        fila.map((celda, x) => (
          <button
            key={`${jugador}-${x}-${y}`}
            onClick={() => fase === 'colocacion' ? colocarBarco(x, y) : (jugador !== jugadorActual && disparo(x, y))}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, x, y)}
            className={`w-10 h-10 flex items-center justify-center border ${
              fase === 'colocacion' 
                ? 'bg-blue-200' 
                : jugador === jugadorActual 
                  ? celda === 3 
                    ? 'bg-blue-400'  // Barco propio
                    : 'bg-blue-300'  // Agua propia
                  : celda === 0 
                    ? 'bg-blue-300'  // Agua enemiga
                    : celda === 1 
                      ? 'bg-gray-400'  // Disparo al agua
                      : celda === 2 
                        ? 'bg-red-500'  // Impacto
                        : 'bg-red-700'  // Hundido
            }`}
            disabled={(fase === 'disparos' && (jugador === jugadorActual || celda !== 0)) || ganador !== null}
          >
            {fase === 'colocacion' && jugador === jugadorActual && celda === 3 && 
              <Ship className="text-blue-600" size={20} />}
            {fase === 'disparos' && celda === 1 && 
              <Crosshair className="text-white" size={20} />}
            {fase === 'disparos' && (celda === 2 || celda === 4) && 
              <Ship className="text-white" size={20} />}
            {jugador === jugadorActual && celda === 3 && fase === 'disparos' &&
              <Ship className="text-blue-800" size={20} />}
          </button>
        ))
      )}
    </div>
  );

   // Nuevo componente para los barcos arrastrables
   const renderBarcosDraggables = () => (
    <div className="flex gap-4 mb-4">
      {TIPOS_BARCOS.map((barco, index) => (
        <div
          key={barco.nombre}
          draggable={index === barcoActual}
          onDragStart={(e) => onDragStart(e, barco)}
          className={`flex items-center gap-2 p-2 border rounded ${
            index === barcoActual ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          <Anchor size={20} />
          <span>{barco.nombre} ({barco.tamaño})</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Batalla Naval - 2 Jugadores</h1>
      {fase === 'colocacion' && (
        <>
          {renderBarcosDraggables()}
          <div className="mb-4">
            <button 
              onClick={() => setOrientacion(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Orientación: {orientacion}
            </button>
          </div>
        </>
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
