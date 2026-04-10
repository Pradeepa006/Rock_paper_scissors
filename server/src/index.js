/**
 * RPS Arena — Server Entry Point
 *
 * Express HTTP server + Socket.io WebSocket server.
 * Handles multiplayer rooms, game state, and real-time sync.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerSocketHandlers } from './socket/socketHandler.js';

// ─── Configuration ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Express App ───────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// ─── HTTP + Socket.io Server ───────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Register all socket event handlers
registerSocketHandlers(io);

// ─── Start Server ──────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🎮 RPS Arena server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io ready for connections`);
  console.log(`🌐 Accepting client from: ${CLIENT_URL}\n`);
});
