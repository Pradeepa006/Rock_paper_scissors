import { Link } from 'react-router-dom';

/**
 * Home Page — Landing screen with game mode selection.
 * Placeholder UI — will be fully designed in Phase 4.
 */
function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      {/* Hero */}
      <div className="animate-slide-up">
        <h1 style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #7c3aed, #ec4899, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.1,
          marginBottom: '0.5rem',
        }}>
          RPS Arena
        </h1>
        <p style={{ color: 'var(--clr-muted)', fontSize: '1.1rem', marginBottom: '3rem' }}>
          Rock • Paper • Scissors — Powered by AI Hand Gesture Recognition
        </p>
      </div>

      {/* Gesture Emoji Display */}
      <div className="animate-float" style={{ fontSize: '4rem', marginBottom: '3rem', display: 'flex', gap: '1.5rem' }}>
        <span>✊</span>
        <span>✋</span>
        <span>✌️</span>
      </div>

      {/* Mode Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '320px' }}>
        <Link to="/game" className="btn btn-primary btn-lg" id="btn-singleplayer">
          🎮 Single Player
        </Link>
        <Link to="/lobby" className="btn btn-accent btn-lg" id="btn-multiplayer">
          👥 Multiplayer
        </Link>
      </div>

      {/* Footer */}
      <p style={{ color: 'var(--clr-muted)', fontSize: '0.8rem', marginTop: '4rem', opacity: 0.5 }}>
        Built with MediaPipe + TensorFlow.js
      </p>
    </div>
  );
}

export default Home;
