import React from 'react';
import { useNavigate } from 'react-router-dom';

function Lobby() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
      <h1>Multiplayer Lobby</h1>
      <p>This page is under construction.</p>
      <button 
        onClick={() => navigate('/')}
        style={{
          padding: '10px 20px',
          marginTop: '20px',
          cursor: 'pointer',
          borderRadius: '5px',
          border: 'none',
          backgroundColor: '#4a90e2',
          color: 'white',
          fontSize: '1rem'
        }}
      >
        Back to Home
      </button>
    </div>
  );
}

export default Lobby;
