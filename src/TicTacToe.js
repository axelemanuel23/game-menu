import React, { useState, useEffect } from 'react';

function TicTacToe() {
  const [board, setBoard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState(null);
  const [boardSize, setBoardSize] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (gameStarted) {
      setBoard(Array(boardSize * boardSize).fill(null));
      setWinner(null);
      setCurrentPlayer('X');
    }
  }, [boardSize, gameStarted]);

  const handleClick = (index) => {
    if (winner || board[index]) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    checkWinner(newBoard);

    if (!winner) {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const checkWinner = (currentBoard) => {
    const lines = [];
    for (let i = 0; i < boardSize; i++) {
      lines.push(Array.from({length: boardSize}, (, j) => i * boardSize + j));
    }
    for (let i = 0; i < boardSize; i++) {
      lines.push(Array.from({length: boardSize}, (, j) => i + j * boardSize));
    }
    lines.push(Array.from({length: boardSize}, (, i) => i * (boardSize + 1)));
    lines.push(Array.from({length: boardSize}, (, i) => (i + 1) * (boardSize - 1)));
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.every(index => currentBoard[index] === currentPlayer)) {
        setWinner(currentPlayer);
        return;
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      setWinner('Empate');
    }
  };
  function Menu({ setBoardSize, setGameStarted }) {
    return (
      <div className="menu">
        <h2>Selecciona el tamaño del tablero:</h2>
        <button onClick={() => setBoardSize(3)}>Tablero 3x3</button>
        <button onClick={() => setBoardSize(4)}>Tablero 4x4</button>
        <button onClick={() => setGameStarted(true)}>Iniciar Juego</button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      {!gameStarted ? (
        <Menu setBoardSize={setBoardSize} setGameStarted={setGameStarted} />
      ) : (
        <>
        <h2>Tic-Tac-Toe {boardSize}x{boardSize}</h2>
        <div className="turn-indicator"
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '20px 0',
            padding: '10px',
            backgroundColor: '#f0f0f0',
            borderRadius: '5px'
          }}
        >
          Turno del Jugador: {currentPlayer}
        </div>
        <div className="board" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          gap: '5px',
          width: `${boardSize * 60}px`,
          margin: '0 auto'
        }}>
          {board.map((value, index) => (
            <div 
            key={index} 
            className="square" 
            onClick={() => handleClick(index)}
            style={{
              width: '60px',
              height: '60px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: '2px solid #333',
              backgroundColor: '#fff',
              transition: 'background-color 0.3s'
            }}
            >
              {value}
            </div>
          ))}
        </div>
        {winner && (
          <div className="winner" style={{
 fontSize: '28px',
 fontWeight: 'bold',
 margin: '20px 0',
 color: winner === 'Empate' ? '#FFA500' : '#4CAF50'
 }}>

 {winner === 'Empate' ? '¡Empate!' : `¡Ganó el Jugador ${winner}!`}
 </div>
 )}
<button 
onClick={() => setGameStarted(false)}
 style={{
fontSize: '18px',
 padding: '10px 20px',
margin: '20px 0',
 cursor: 'pointer',
 backgroundColor: '#4CAF50',
 color: 'white',
 border: 'none',
 borderRadius: '5px',
transition: 'background-color 0.3s'
 }}
>
Volver al Menú
</button>
</>
)}
</div>
  )
}
export default TicTacToe;
