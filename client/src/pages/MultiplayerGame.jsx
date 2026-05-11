import { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
const Hands = window.Hands;
import { classifyGesture } from '../services/gestureRecognition';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function MultiplayerGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket   = useSocket();
  const { roomId, initialRoom } = location.state || {};

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const gestureRef     = useRef('none');
  const handsRef       = useRef(null);
  const streamRef      = useRef(null);
  const pcRef          = useRef(null);
  const icePendingRef  = useRef([]);
  // If non-host signals ready before host PC is created, queue it
  const peerReadyQueued = useRef(false);

  const [phase, setPhase]             = useState('waiting');
  const [countdown, setCountdown]     = useState(null);
  const [roundNum, setRoundNum]       = useState(1);
  const [totalRounds]                 = useState(initialRoom?.totalRounds ?? 5);
  const [myGesture, setMyGesture]     = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [oppLeft, setOppLeft]         = useState(false);
  const [statusMsg, setStatusMsg]     = useState('Waiting for host to start…');
  const [remoteReady, setRemoteReady] = useState(false);

  const isHost   = initialRoom?.hostId === socket?.id;
  const me       = roundResult?.players?.find(p => p.id === socket?.id) ?? initialRoom?.players?.find(p => p.id === socket?.id);
  const opponent = roundResult?.players?.find(p => p.id !== socket?.id) ?? initialRoom?.players?.find(p => p.id !== socket?.id);
  const myScore  = roundResult?.players?.find(p => p.id === socket?.id)?.score ?? 0;
  const oppScore = roundResult?.players?.find(p => p.id !== socket?.id)?.score ?? 0;
  const winId    = roundResult?.winner === 'draw' ? null : roundResult?.winnerId;
  const iWon     = winId === socket?.id;
  const isDraw   = roundResult?.winner === 'draw';

  useEffect(() => {
    if (!roomId || !socket) { navigate('/'); return; }

    let animId;

    // ── Helper: flush queued ICE candidates ────────────────────────
    const flushIce = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      const q = [...icePendingRef.current];
      icePendingRef.current = [];
      for (const c of q) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
      }
    };

    // ── Helper: create & send WebRTC offer ─────────────────────────
    const sendOffer = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { roomId, offer });
      } catch (e) { console.error('Offer error:', e); }
    };

    // ── STEP 1: Register ALL socket handlers synchronously FIRST ───
    // (before any async work, so no events are missed)

    socket.on('webrtc-peer-ready', async () => {
      if (!isHost) return;
      if (!pcRef.current) { peerReadyQueued.current = true; return; }
      await sendOffer();
    });

    socket.on('webrtc-offer', async ({ offer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { roomId, answer });
      } catch (e) { console.error('Answer error:', e); }
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce();
      } catch (e) { console.error('Set answer error:', e); }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) { icePendingRef.current.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    });

    socket.on('round-starting', ({ round }) => {
      setPhase('waiting'); setRoundNum(round);
      setMyGesture(null); setRoundResult(null);
      setStatusMsg(`Round ${round} starting…`);
    });
    socket.on('countdown', ({ count }) => { setPhase('countdown'); setCountdown(count); });
    socket.on('capture-gesture', () => {
      setPhase('capture');
      const g = gestureRef.current;
      setMyGesture(g);
      socket.emit('submit-gesture', roomId, ['rock','paper','scissors'].includes(g) ? g : 'rock');
      setStatusMsg('Gesture sent! Waiting for opponent…');
    });
    socket.on('round-result', res => { setRoundResult(res); setPhase(res.gameOver ? 'gameover' : 'result'); });
    socket.on('player-left', () => { setOppLeft(true); setPhase('gameover'); });

    // ── STEP 2: Async init (after handlers are registered) ─────────
    let isMounted = true;
    const init = async () => {
      // ── 2a. Create RTCPeerConnection FIRST (before camera) ───────
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.ontrack = e => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setRemoteReady(true);
        }
      };
      pc.onicecandidate = e => {
        if (e.candidate) socket.emit('webrtc-ice-candidate', { roomId, candidate: e.candidate });
      };

      // ── 2b. Try to get camera (non-critical for signaling) ────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        
        // If unmounted while waiting for camera, immediately release it and stop
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        // Add tracks to peer connection
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        // Show local video + start MediaPipe gesture detection
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.onloadedmetadata = () => {
            if (!isMounted) return;
            localVideoRef.current.play();

            // Init MediaPipe Hands
            const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            hands.onResults(r => {
              gestureRef.current = r.multiHandLandmarks?.length > 0
                ? classifyGesture(r.multiHandLandmarks[0]) : 'none';
            });
            handsRef.current = hands;

            const tick = async () => {
              if (!isMounted) return;
              if (localVideoRef.current?.readyState >= 2 && handsRef.current) {
                await handsRef.current.send({ image: localVideoRef.current });
              }
              animId = requestAnimationFrame(tick);
            };
            tick();
          };
        }
      } catch (err) {
        if (isMounted) console.warn('Camera unavailable:', err.message);
      }

      if (!isMounted) return;

      // ── 2c. Signal ready REGARDLESS of camera success ─────────────
      if (!isHost) {
        socket.emit('webrtc-ready', { roomId });
      } else if (peerReadyQueued.current) {
        peerReadyQueued.current = false;
        await sendOffer();
      }
    };

    init();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (handsRef.current) handsRef.current.close();
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      ['webrtc-peer-ready','webrtc-offer','webrtc-answer','webrtc-ice-candidate',
       'round-starting','countdown','capture-gesture','round-result','player-left']
        .forEach(e => socket.off(e));
    };
  }, [roomId, socket, isHost, navigate]); // eslint-disable-line

  const handleNextRound = useCallback(() => { if (isHost) socket.emit('start-round', roomId); }, [isHost, socket, roomId]);
  const handleLeave = useCallback(() => { socket.emit('leave-room', roomId); navigate('/'); }, [socket, roomId, navigate]);
  const emoji = g => ({ rock:'✊', paper:'✋', scissors:'✌️' }[g] ?? '❓');

  // ── Shared video card styles ──────────────────────────────────────
  const videoCardStyle = (borderColor) => ({
    flex: '1 1 300px', maxWidth: '430px', position: 'relative',
    aspectRatio: '4/3', borderRadius: '16px', overflow: 'hidden',
    border: phase === 'countdown' ? '2px solid var(--clr-warning)' : `2px solid ${borderColor}`,
    background: '#111',
  });

  const nameTagStyle = {
    position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 10, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
    padding: '4px 14px', borderRadius: '20px', fontSize: '0.8rem',
    fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
    border: '1px solid rgba(255,255,255,0.15)',
  };

  const countdownOverlay = (key) => phase === 'countdown' && (
    <div key={key} className="animate-countdown" style={{
      position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: '7rem', fontWeight: 900, color: 'white',
      textShadow: '0 4px 24px rgba(0,0,0,0.8)', fontFamily: 'Outfit',
      pointerEvents: 'none',
    }}>
      {countdown > 0 ? countdown : 'GO!'}
    </div>
  );

  const gestureChip = (g) => g && (
    <div style={{
      position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.8)', color: '#fff',
      padding: '4px 16px', borderRadius: '20px', fontSize: '1rem',
      fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', gap: '6px', alignItems: 'center',
    }}>
      {emoji(g)} <span style={{ textTransform: 'capitalize' }}>{g}</span>
    </div>
  );

  const oppGesture = roundResult?.players?.find(p => p.id !== socket?.id)?.gesture;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '1rem 1.5rem', textAlign: 'center' }}>

      {/* Title */}
      <h1 className="animate-slide-up" style={{ fontFamily: 'Outfit,sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--clr-primary-light)', margin: '0 0 0.25rem' }}>
        ⚔️ Multiplayer Battle
      </h1>
      <p style={{ color: 'var(--clr-muted)', marginBottom: '1rem' }}>
        Round <strong style={{ color: 'var(--clr-text)' }}>{roundNum}</strong> / <strong style={{ color: 'var(--clr-text)' }}>{totalRounds}</strong>
      </p>

      {/* Score */}
      <div className="glass-card animate-slide-up" style={{ display: 'flex', gap: 0, alignItems: 'stretch', padding: 0, marginBottom: '1.25rem', borderRadius: '16px', overflow: 'hidden', width: '100%', maxWidth: '480px' }}>
        <div style={{ flex: 1, padding: '0.75rem 1.5rem', background: 'rgba(16,185,129,0.1)', borderRight: '1px solid var(--clr-border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--clr-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{me?.name ?? 'You'} {isHost ? '👑' : ''}</div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, fontFamily: 'Outfit', color: 'var(--clr-success)', lineHeight: 1 }}>{myScore}</div>
        </div>
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', fontSize: '1rem', fontWeight: 800, color: 'var(--clr-muted)' }}>VS</div>
        <div style={{ flex: 1, padding: '0.75rem 1.5rem', background: 'rgba(244,114,182,0.1)', borderLeft: '1px solid var(--clr-border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--clr-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{opponent?.name ?? 'Opponent'} {!isHost ? '👑' : ''}</div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, fontFamily: 'Outfit', color: 'var(--clr-accent)', lineHeight: 1 }}>{oppScore}</div>
        </div>
      </div>

      {/* Face-to-face video */}
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: '960px', marginBottom: '1.25rem' }}>

        {/* LOCAL */}
        <div style={videoCardStyle('rgba(16,185,129,0.6)')}>
          <div style={nameTagStyle}>{me?.name ?? 'You'} {isHost ? '👑' : ''} <span style={{ color: '#6ee7b7' }}>· You</span></div>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          {countdownOverlay('l')}
          {(phase === 'capture' || phase === 'result') && gestureChip(myGesture)}
        </div>

        {/* VS divider */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: 'var(--clr-muted)' }}>
          <div style={{ fontSize: '2rem' }}>⚔️</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '2px' }}>VS</div>
        </div>

        {/* REMOTE */}
        <div style={videoCardStyle('rgba(244,114,182,0.6)')}>
          <div style={nameTagStyle}>{opponent?.name ?? 'Opponent'} {!isHost ? '👑' : ''} <span style={{ color: '#f9a8d4' }}>· Opponent</span></div>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {!remoteReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', gap: '0.5rem' }}>
              <div style={{ fontSize: '2rem' }}>📡</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>Connecting video…</div>
            </div>
          )}
          {countdownOverlay('r')}
          {(phase === 'result') && gestureChip(oppGesture)}
        </div>
      </div>

      {/* Info Panel */}
      <div style={{ width: '100%', maxWidth: '960px' }}>

        {phase === 'gameover' && (
          <div className="glass-card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            {oppLeft
              ? <h2 style={{ color: 'var(--clr-warning)', margin: 0 }}>🚪 Opponent Left the Game</h2>
              : <>
                  <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem', color: myScore > oppScore ? 'var(--clr-success)' : oppScore > myScore ? 'var(--clr-accent)' : 'var(--clr-warning)' }}>
                    {myScore > oppScore ? '🏆 You Win the Match!' : oppScore > myScore ? '💀 You Lose!' : '🤝 Match Tied!'}
                  </h2>
                  <p style={{ color: 'var(--clr-muted)', margin: 0 }}>Final Score: <strong style={{ color: 'var(--clr-primary-light)', fontSize: '1.2rem' }}>{myScore} – {oppScore}</strong></p>
                </>
            }
          </div>
        )}

        {phase === 'result' && roundResult && (
          <div className="glass-card animate-slide-up" style={{ padding: '1rem 1.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.75rem', color: iWon ? 'var(--clr-success)' : isDraw ? 'var(--clr-warning)' : 'var(--clr-accent)' }}>
              {iWon ? '🎉 You Win This Round!' : isDraw ? "🤝 It's a Draw!" : '😤 Opponent Wins This Round!'}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '1rem' }}>
              {roundResult.players.map(p => {
                const isMe = p.id === socket?.id;
                const won  = p.id === winId;
                return (
                  <div key={p.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '0.75rem 1.5rem', borderRadius: '14px', transition: 'all 0.4s ease',
                    ...(won ? { border: '2px solid var(--clr-success)', background: 'rgba(16,185,129,0.1)', transform: 'scale(1.1)' }
                            : isDraw ? {} : { opacity: 0.4, transform: 'scale(0.9)', filter: 'grayscale(60%)' })
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--clr-muted)', marginBottom: '0.25rem' }}>{isMe ? 'You' : opponent?.name}</div>
                    <div style={{ fontSize: '3rem' }}>{emoji(p.gesture)}</div>
                    <div style={{ fontSize: '0.8rem', textTransform: 'capitalize', color: 'var(--clr-text)' }}>{p.gesture}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {['waiting','countdown','capture'].includes(phase) && (
          <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ color: 'var(--clr-muted)' }}>
              {phase === 'waiting'   && statusMsg}
              {phase === 'countdown' && '🎯 Get ready — show your gesture when GO! appears!'}
              {phase === 'capture'   && '📸 Gesture captured! Waiting for opponent…'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {isHost && phase === 'result'   && <button className="btn btn-primary btn-lg" onClick={handleNextRound} style={{ width: '100%' }}>▶ Next Round</button>}
          {isHost && phase === 'gameover' && <button className="btn btn-primary btn-lg" onClick={handleNextRound} style={{ width: '100%' }}>🔄 Play Again</button>}
          {!isHost && (phase === 'result' || phase === 'gameover') && (
            <div style={{ color: 'var(--clr-warning)', fontSize: '0.9rem', padding: '0.5rem' }}>⏳ Waiting for host to start next round…</div>
          )}
          <button className="btn btn-secondary" onClick={handleLeave} style={{ width: '100%' }}>← Leave Game</button>
        </div>
      </div>
    </div>
  );
}

export default MultiplayerGame;
