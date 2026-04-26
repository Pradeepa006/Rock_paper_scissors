import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';

function Lobby() {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams();
  const socket = useSocket();

  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null); // the active room state
  const [loading, setLoading] = useState(false);

  // When another player joins or status updates
  useEffect(() => {
    if (!socket) return;

    socket.on('player-joined', ({ playerName, room }) => {
      setRoom(room);
    });
    
    socket.on('player-left', ({ playerId }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== playerId)
        };
      });
    });

    socket.on('round-starting', () => {
      setRoom((currentRoom) => {
        if (currentRoom) {
          navigate('/game', { state: { isMultiplayer: true, roomId: currentRoom.id, initialRoom: currentRoom } });
        }
        return currentRoom;
      });
    });

    return () => {
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('round-starting');
    };
  }, [socket]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('Please enter a name');
    setError(null);
    setLoading(true);

    socket.emit('create-room', playerName, (response) => {
      setLoading(false);
      if (response.success) {
        setRoom(response.room);
        navigate(`/lobby/${response.room.id}`, { replace: true });
      } else {
        setError(response.error);
      }
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('Please enter a name');
    setError(null);
    setLoading(true);

    socket.emit('join-room', urlRoomId, playerName, (response) => {
      setLoading(false);
      if (response.success) {
        setRoom(response.room);
      } else {
        setError(response.error);
        // Optional: clear url param if invalid room
      }
    });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/lobby/${room.id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!'); // using generic alert until Toast is set up
  };

  if (!socket) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2 style={{ color: 'white' }}>Connecting to Server...</h2>
      </div>
    );
  }

  // ── Waiting Room View ──────────────────────────────────────────────
  if (room) {
    const isHost = room.hostId === socket.id;
    const isFull = room.players.length === 2;

    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1rem', color: '#ec4899' }}>Waiting Room</h1>
        
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Room Code: <strong>{room.id}</strong></p>
          <button onClick={copyLink} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '1rem' }}>
            📋 Copy Invite Link
          </button>
        </div>

        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {room.players.map((p, index) => (
            <div key={p.id} style={{ 
              background: p.id === socket.id ? 'rgba(124, 58, 237, 0.4)' : 'rgba(255,255,255,0.05)',
              padding: '1.5rem',
              borderRadius: '8px',
              minWidth: '150px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{p.name}</h3>
              <p style={{ margin: 0, color: 'var(--clr-muted)' }}>{p.id === socket.id ? '(You)' : ''}</p>
            </div>
          ))}
          {room.players.length < 2 && (
            <div style={{ 
              background: 'rgba(255,255,255,0.02)',
              border: '2px dashed rgba(255,255,255,0.2)',
              padding: '1.5rem',
              borderRadius: '8px',
              minWidth: '150px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)'
            }}>
              Waiting for player...
            </div>
          )}
        </div>

        {isHost ? (
          <button 
            className="btn btn-accent btn-lg" 
            disabled={!isFull}
            onClick={() => socket.emit('start-round', room.id)}
            style={{ opacity: !isFull ? 0.5 : 1, width: '100%' }}
          >
            {isFull ? 'Start Game' : 'Waiting for Opponent...'}
          </button>
        ) : (
          <p style={{ fontSize: '1.2rem', color: '#f59e0b' }}>Waiting for Host to start the game...</p>
        )}
      </div>
    );
  }

  // ── Setup View (Create / Join based on URL) ─────────────────────────
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', maxWidth: '400px', margin: '0 auto', paddingTop: '10vh' }}>
      <h1 style={{ marginBottom: '2rem', fontFamily: 'Outfit' }}>
        {urlRoomId ? 'Join Room' : 'Create Room'}
      </h1>

      {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

      <form onSubmit={urlRoomId ? handleJoinRoom : handleCreateRoom}>
        <input
          type="text"
          placeholder="Enter your nickname"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={12}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: '8px',
            border: '2px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'white',
            fontSize: '1.2rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}
        />
        
        <button 
          type="submit" 
          className="btn btn-primary btn-lg" 
          style={{ width: '100%', marginBottom: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Processing...' : (urlRoomId ? `Join Room ${urlRoomId}` : 'Create Room')}
        </button>
      </form>

      <button 
        onClick={() => navigate('/')}
        className="btn"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--clr-muted)',
          textDecoration: 'underline'
        }}
      >
        Cancel & Return Home
      </button>
    </div>
  );
}

export default Lobby;

