import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import Lobby from './pages/Lobby.jsx';

/**
 * App — Root component with client-side routing.
 *
 * Routes:
 *   /         → Home page (mode selection)
 *   /game     → Single player game screen
 *   /lobby    → Multiplayer lobby (create/join room)
 */
function App() {
  return (
    <Router>
      <div className="app-container" style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/lobby" element={<Lobby />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
