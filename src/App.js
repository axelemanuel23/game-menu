// App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import NavalBattle from './NavalBattle';
import TicTacToe from './TicTacToe';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between">
              <div className="flex space-x-7">
                <div className="flex items-center py-4">
                  <span className="font-semibold text-gray-500 text-lg">MENU DE INFORMACION ULTRA IMPORTANTE</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Link to="/navalbattle" className="py-2 px-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300">Batalla Naval</Link>
                <Link to="/tictactoe" className="py-2 px-3 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300">Ta-Te-Ti</Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto mt-8 px-4">
          <Routes>
            <Route path="/navalbattle" element={<NavalBattle />} />
            <Route path="/tictactoe" element={<TicTacToe />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
