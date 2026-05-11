/**
 * Socket.io Event Handler
 *
 * Registers all WebSocket events: room creation, joining,
 * gesture submission, countdown sync, and disconnection.
 */

import { RoomManager } from '../services/roomManager.js';
import { GameService } from '../services/gameService.js';

const roomManager = new RoomManager();
const gameService = new GameService();

/**
 * Register all socket event handlers on the io instance.
 * @param {import('socket.io').Server} io
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    // ── Create Room ──────────────────────────────────────────────
    socket.on('create-room', (playerName, callback) => {
      try {
        const room = roomManager.createRoom(socket.id, playerName);
        socket.join(room.id);
        console.log(`🏠 Room created: ${room.id} by ${playerName}`);
        callback({ success: true, room });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // ── Join Room ────────────────────────────────────────────────
    socket.on('join-room', (roomId, playerName, callback) => {
      try {
        const room = roomManager.joinRoom(roomId, socket.id, playerName);
        socket.join(roomId);
        console.log(`👤 ${playerName} joined room: ${roomId}`);

        // Notify the other player
        socket.to(roomId).emit('player-joined', {
          playerName,
          playerId: socket.id,
          room,
        });

        callback({ success: true, room });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // ── Start Round (host triggers) ──────────────────────────────
    socket.on('start-round', (roomId) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      if (room.hostId !== socket.id) return;
      if (room.players.length < 2) return;

      // If the match was finished, reset scores and round counter for a fresh game
      if (room.status === 'finished') {
        room.players.forEach((p) => { p.score = 0; });
        room.currentRound = 1;
        room.status = 'playing';
      }

      // Reset gestures for the new round
      gameService.resetRound(room);

      // Broadcast round-starting to both players
      io.to(roomId).emit('round-starting', { round: room.currentRound });

      // Synchronized countdown: 3-2-1-GO
      let count = 3;
      const interval = setInterval(() => {
        io.to(roomId).emit('countdown', { count });
        count--;

        if (count < 0) {
          clearInterval(interval);
          io.to(roomId).emit('capture-gesture');
        }
      }, 1000);
    });

    // ── Submit Gesture ───────────────────────────────────────────
    socket.on('submit-gesture', (roomId, gesture) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      gameService.submitGesture(room, socket.id, gesture);
      console.log(`🤚 ${socket.id} played: ${gesture} in room ${roomId}`);

      // Check if both players have submitted
      if (gameService.bothPlayersReady(room)) {
        const result = gameService.determineWinner(room);
        io.to(roomId).emit('round-result', result);
        console.log(`🏆 Round result in ${roomId}:`, result.winner);
      }
    });

    // ── WebRTC Signaling Relay ────────────────────────────────────
    // Non-host signals it's ready → host creates offer
    socket.on('webrtc-ready', ({ roomId }) => {
      socket.to(roomId).emit('webrtc-peer-ready');
    });

    // Relay offer from host to non-host
    socket.on('webrtc-offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('webrtc-offer', { offer });
    });

    // Relay answer from non-host to host
    socket.on('webrtc-answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc-answer', { answer });
    });

    // Relay ICE candidates between peers
    socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc-ice-candidate', { candidate });
    });

    // ── Leave Room ───────────────────────────────────────────────
    socket.on('leave-room', (roomId) => {
      handlePlayerLeave(socket, roomId, io);
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`❌ Player disconnected: ${socket.id}`);
      const roomId = roomManager.findPlayerRoom(socket.id);
      if (roomId) {
        handlePlayerLeave(socket, roomId, io);
      }
    });
  });
}

/**
 * Handle a player leaving or disconnecting from a room.
 */
function handlePlayerLeave(socket, roomId, io) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  socket.to(roomId).emit('player-left', { playerId: socket.id });
  roomManager.removePlayer(roomId, socket.id);
  socket.leave(roomId);

  // Clean up empty rooms
  if (room.players.length === 0) {
    roomManager.deleteRoom(roomId);
    console.log(`🗑️  Room deleted: ${roomId}`);
  }
}

