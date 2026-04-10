import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Game Page — Single player mode.
 * Integrates webcam for gesture detection (Phase 3).
 */
function Game() {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream = null;
    
    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing the webcam: ", err);
      }
    }
    
    startWebcam();

    return () => {
      // Cleanup: stop camera tracks when the component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
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
      <div className="animate-slide-up">
        <h1 style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '2.5rem',
          fontWeight: 800,
          color: 'var(--clr-primary-light)',
          marginBottom: '1rem',
        }}>
          🎮 Single Player
        </h1>

        {/* Webcam feed */}
        <div className="glass-card" style={{
          width: '100%',
          maxWidth: '640px',
          aspectRatio: '4/3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '2rem',
          overflow: 'hidden',
          padding: 0,
          position: 'relative'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror effect for better UX
              borderRadius: 'inherit'
            }}
          />
        </div>

        {/* Score placeholder */}
        <div className="glass-card" style={{
          padding: '1.5rem 2.5rem',
          display: 'flex',
          gap: '3rem',
          justifyContent: 'center',
          marginBottom: '2rem',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', marginBottom: '0.25rem' }}>YOU</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit' }}>0</div>
          </div>
          <div style={{ fontSize: '1.5rem', color: 'var(--clr-muted)', alignSelf: 'center' }}>vs</div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', marginBottom: '0.25rem' }}>AI</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit' }}>0</div>
          </div>
        </div>

        <Link to="/" className="btn btn-secondary">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

export default Game;
