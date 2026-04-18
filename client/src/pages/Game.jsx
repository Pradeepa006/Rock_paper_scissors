import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// MediaPipe is loaded globally via CDN in index.html to avoid Vite bundler missing export errors
const Hands = window.Hands;
import { classifyGesture, getRandomAIChoice, determineWinner } from '../services/gestureRecognition';

/**
 * Game Page — Single player mode.
 * Integrates webcam for gesture detection using MediaPipe.
 */
function Game() {
  const videoRef = useRef(null);
  
  // Game States
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'countdown' | 'result'
  const [countdownDuration, setCountdownDuration] = useState(3);
  const [totalRounds, setTotalRounds] = useState(5);
  const [currentRound, setCurrentRound] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [roundFailed, setRoundFailed] = useState(false);
  
  const [currentCountdown, setCurrentCountdown] = useState(0);
  const [scores, setScores] = useState({ user: 0, ai: 0 });
  const [choices, setChoices] = useState({ user: null, ai: null });
  const [resultText, setResultText] = useState('');
  const [roundWinner, setRoundWinner] = useState(null);
  
  const currentGestureRef = useRef('none');
  const handsRef = useRef(null);

  // Initialize MediaPipe and Webcam
  useEffect(() => {
    let stream = null;
    let animationFrameId;
    let videoElement = videoRef.current;

    const initMediaPipe = async () => {
      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      hands.onResults((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          currentGestureRef.current = classifyGesture(landmarks);
        } else {
          currentGestureRef.current = 'none';
        }
      });
      
      handsRef.current = hands;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
             videoElement.play();
             const processVideo = async () => {
                if (videoElement.readyState >= 2 && handsRef.current) {
                  await handsRef.current.send({ image: videoElement });
                }
                animationFrameId = requestAnimationFrame(processVideo);
             };
             processVideo();
          };
        }
      } catch (err) {
        console.error("Error accessing the webcam: ", err);
      }
    };
    
    initMediaPipe();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (handsRef.current) handsRef.current.close();
    };
  }, []);

  const startRound = () => {
    if (gameState === 'idle' || matchOver) {
      setScores({ user: 0, ai: 0 });
      setCurrentRound(1);
      setMatchOver(false);
      setRoundFailed(false);
    } else {
      if (!roundFailed) {
        setCurrentRound(prev => prev + 1);
      }
      setRoundFailed(false);
    }
    
    setGameState('countdown');
    setCurrentCountdown(countdownDuration);
    setChoices({ user: null, ai: null });
    setResultText('');
    setRoundWinner(null);
  };

  // Timer logical loop
  useEffect(() => {
    let timer;
    if (gameState === 'countdown' && currentCountdown > 0) {
      timer = setTimeout(() => {
        setCurrentCountdown(prev => prev - 1);
      }, 1000);
    } else if (gameState === 'countdown' && currentCountdown === 0) {
      // Countdown finished -> resolve game round
      const userGesture = currentGestureRef.current;
      let aiGesture = getRandomAIChoice();
      const winner = determineWinner(userGesture, aiGesture);
      
      let newUserScore = scores.user;
      let newAiScore = scores.ai;
      
      const failed = userGesture === 'none';
      setRoundFailed(failed);
      
      let newMessage = '';
      if (failed) {
         newMessage = "No gesture detected! Try again.";
         aiGesture = 'none'; // mask AI choice since round is invalid
      } else {
        if (winner === 'user') {
          newMessage = 'You Win This Round!';
          newUserScore += 1;
        } else if (winner === 'ai') {
          newMessage = 'AI Wins This Round!';
          newAiScore += 1;
        } else {
          newMessage = 'Draw!';
        }
      }
      
      setScores({ user: newUserScore, ai: newAiScore });
      
      if (!failed && currentRound >= totalRounds) {
         setMatchOver(true);
         if (newUserScore > newAiScore) {
            newMessage = `Match Over! You won ${newUserScore}-${newAiScore}! 🏆`;
         } else if (newAiScore > newUserScore) {
            newMessage = `Match Over! AI won ${newAiScore}-${newUserScore}! 🤖`;
         } else {
            newMessage = `Match Over! It's a tie ${newUserScore}-${newAiScore}! 🤝`;
         }
      }
      
      setChoices({ user: userGesture, ai: aiGesture });
      setResultText(newMessage);
      setRoundWinner(failed ? null : winner);
      setGameState('result');
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    }
  }, [gameState, currentCountdown, countdownDuration, currentRound, totalRounds]); // Note: omitted `scores` to avoid stale reads resetting timers incorrectly, simple primitive references mostly used.

  // View helpers
  const getEmoji = (choice) => {
    switch(choice) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
      default: return '❓';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem',
      textAlign: 'center',
      overflow: 'hidden'
    }}>
      <h1 className="animate-slide-up" style={{
        fontFamily: 'Outfit, sans-serif',
        fontSize: '2.5rem',
        fontWeight: 800,
        color: 'var(--clr-primary-light)',
        marginBottom: '1rem',
      }}>
        🎮 Single Player
      </h1>
      
      {gameState === 'idle' && (
         <div className="animate-slide-up" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             <label style={{ color: 'var(--clr-muted)'}}>Countdown (sec): </label>
             <input 
               type="number" 
               min="1"
               max="10"
               value={countdownDuration} 
               onChange={(e) => setCountdownDuration(Math.max(1, parseInt(e.target.value) || 3))}
               style={{
                 background: 'var(--clr-surface)',
                 color: 'var(--clr-text)',
                 border: '1px solid var(--clr-border)',
                 padding: '5px 10px',
                 borderRadius: '5px',
                 width: '60px',
                 textAlign: 'center'
               }}
             />
           </div>
           
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             <label style={{ color: 'var(--clr-muted)'}}>Rounds (5-20): </label>
             <input 
               type="number" 
               min="5"
               max="20"
               value={totalRounds} 
               onChange={(e) => {
                 let val = parseInt(e.target.value);
                 if (isNaN(val)) val = 5;
                 setTotalRounds(val);
               }}
               onBlur={(e) => {
                 let val = parseInt(e.target.value);
                 if (isNaN(val) || val < 5) val = 5;
                 if (val > 20) val = 20;
                 setTotalRounds(val);
               }}
               style={{
                 background: 'var(--clr-surface)',
                 color: 'var(--clr-text)',
                 border: '1px solid var(--clr-border)',
                 padding: '5px 10px',
                 borderRadius: '5px',
                 width: '60px',
                 textAlign: 'center'
               }}
             />
           </div>
         </div>
      )}

      <div className="animate-slide-up" style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '2rem',
        justifyContent: 'center',
        alignItems: 'stretch',
        width: '100%',
        maxWidth: '1000px'
      }}>
        
        {/* Left Side: Webcam feed */}
        <div className="glass-card" style={{
          flex: '1 1 400px',
          aspectRatio: '4/3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: 0,
          position: 'relative',
          border: gameState === 'countdown' ? '2px solid var(--clr-warning)' : '1px solid var(--clr-border)'
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
          
          {gameState === 'countdown' && (
             <div className="animate-countdown" key={currentCountdown} style={{
               position: 'absolute',
               fontSize: '8rem',
               fontWeight: 900,
               color: 'white',
               textShadow: '0 4px 20px rgba(0,0,0,0.5)',
               fontFamily: 'Outfit'
             }}>
                {currentCountdown > 0 ? currentCountdown : 'GO!'}
             </div>
          )}
        </div>

        {/* Right Side: Score, Results & Controls */}
        <div style={{
          flex: '1 1 300px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          
          {/* Score Board */}
          <div className="glass-card" style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {currentRound > 0 && (
               <div style={{ color: 'var(--clr-primary-light)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Round {currentRound} / {totalRounds}
               </div>
            )}
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', marginBottom: '0.25rem' }}>YOU</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit' }}>{scores.user}</div>
              </div>
              <div style={{ color: 'var(--clr-border)', height: '40px', width: '2px', background: 'var(--clr-border)' }}></div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', marginBottom: '0.25rem' }}>AI</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit' }}>{scores.ai}</div>
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="glass-card" style={{
             padding: '1.5rem',
             display: 'flex',
             flexDirection: 'column',
             gap: '1rem',
             minHeight: matchOver ? '260px' : '180px',
             justifyContent: 'center',
             transition: 'min-height 0.3s'
          }}>
             {matchOver ? (
               <div className="animate-slide-up" style={{ textAlign: 'center' }}>
                 <h2 style={{ fontSize: '2rem', color: scores.user > scores.ai ? 'var(--clr-success)' : scores.ai > scores.user ? 'var(--clr-accent)' : 'var(--clr-warning)', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 1rem 0' }}>
                   {scores.user > scores.ai ? '🏆 You Win The Match! 🏆' : scores.ai > scores.user ? '💀 AI Dominates! 💀' : '🤝 Match Tied! 🤝'}
                 </h2>
                 <p style={{ color: 'var(--clr-text)', fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                   Final Score: <strong style={{ color: 'var(--clr-primary-light)'}}>{scores.user} - {scores.ai}</strong>
                 </p>
                 <div className="animate-pulse-glow" style={{
                     display: 'inline-block',
                     padding: '20px 40px',
                     borderRadius: '20px',
                     background: scores.user > scores.ai ? 'rgba(16, 185, 129, 0.2)' : scores.ai > scores.user ? 'rgba(244, 114, 182, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                     border: `2px solid ${scores.user > scores.ai ? 'var(--clr-success)' : scores.ai > scores.user ? 'var(--clr-accent)' : 'var(--clr-warning)'}`
                 }}>
                    <span style={{ fontSize: '4rem' }}>
                       {scores.user > scores.ai ? '🎉' : scores.ai > scores.user ? '🤖' : '⚖️'}
                    </span>
                 </div>
               </div>
             ) : gameState === 'result' ? (
               <div className="animate-slide-up">
                 <h2 style={{ fontSize: '1.3rem', color: 'var(--clr-primary-light)', marginBottom: '1rem', lineHeight: '1.4' }}>{resultText}</h2>
                 <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    <div style={{
                       display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                       ...(roundWinner === 'user' ? { boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)', border: '2px solid var(--clr-success)', borderRadius: '15px', transform: 'scale(1.15)', background: 'rgba(16, 185, 129, 0.1)' } : roundWinner === 'ai' ? { opacity: 0.4, transform: 'scale(0.9)', filter: 'grayscale(100%)' } : {})
                    }}>
                      <div style={{ color: 'var(--clr-muted)', fontSize: '0.9rem' }}>You Played</div>
                      <div style={{ fontSize: '3.5rem' }}>
                        {getEmoji(choices.user)}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.2rem', color: 'var(--clr-muted)', fontWeight: 800 }}>VS</div>
                    <div style={{
                       display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                       ...(roundWinner === 'ai' ? { boxShadow: '0 0 30px rgba(244, 114, 182, 0.3)', border: '2px solid var(--clr-accent)', borderRadius: '15px', transform: 'scale(1.15)', background: 'rgba(244, 114, 182, 0.1)' } : roundWinner === 'user' ? { opacity: 0.4, transform: 'scale(0.9)', filter: 'grayscale(100%)' } : {})
                    }}>
                      <div style={{ color: 'var(--clr-muted)', fontSize: '0.9rem' }}>AI Played</div>
                      <div style={{ fontSize: '3.5rem' }}>
                        {getEmoji(choices.ai)}
                      </div>
                    </div>
                 </div>
               </div>
             ) : (
               <div style={{ color: 'var(--clr-muted)', opacity: 0.7 }}>
                 {gameState === 'countdown' ? 'Analyzing your gesture...' : 'Waiting to start...'}
               </div>
             )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
             {gameState !== 'countdown' && (
               <button className="btn btn-primary btn-lg" onClick={startRound} style={{ width: '100%' }}>
                 {gameState === 'idle' ? 'Start Game' : (matchOver ? 'Play Again' : 'Next Round')}
               </button>
             )}
             <Link to="/" className="btn btn-secondary" style={{ width: '100%' }}>
               ← Back to Home
             </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Game;
