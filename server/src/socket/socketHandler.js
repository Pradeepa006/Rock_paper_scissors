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

      // Reset gestures for the new round
      gameService.resetRound(room);

      // Broadcast countdown to both players
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
