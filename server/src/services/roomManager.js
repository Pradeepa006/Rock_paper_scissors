/**
 * Room Manager Service
 *
 * Handles creation, joining, and lifecycle of multiplayer rooms.
 * Each room stores players, scores, and round state.
 */

import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /**
   * Create a new room with the host player.
   * @param {string} socketId - Host's socket ID
   * @param {string} playerName - Host's display name
   * @returns {Room}
   */
  createRoom(socketId, playerName) {
    // Generate a short, readable room code (6 chars)
    const roomId = uuidv4().slice(0, 6).toUpperCase();

    const room = {
      id: roomId,
      hostId: socketId,
      players: [
        {
          id: socketId,
          name: playerName,
          score: 0,
          gesture: null,
          ready: false,
        },
      ],
      currentRound: 1,
      totalRounds: 5,
      status: 'waiting', // waiting | playing | finished
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Add a player to an existing room.
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} playerName
   * @returns {Room}
   */
  joinRoom(roomId, socketId, playerName) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error(`Room "${roomId}" not found.`);
    }
    if (room.players.length >= 2) {
      throw new Error('Room is full.');
    }
    if (room.status !== 'waiting') {
      throw new Error('Game already in progress.');
    }

    room.players.push({
      id: socketId,
      name: playerName,
      score: 0,
      gesture: null,
      ready: false,
    });

    room.status = 'playing';
    return room;
  }

  /**
   * Get a room by ID.
   * @param {string} roomId
   * @returns {Room | undefined}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Find which room a player is in.
   * @param {string} socketId
   * @returns {string | null} Room ID or null
   */
  findPlayerRoom(socketId) {
    for (const [roomId, room] of this.rooms) {
      if (room.players.some((p) => p.id === socketId)) {
        return roomId;
      }
    }
    return null;
  }

  /**
   * Remove a player from a room.
   * @param {string} roomId
   * @param {string} socketId
   */
  removePlayer(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socketId);

    // If host left, assign new host
    if (room.hostId === socketId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }

    // Reset status if only one player remains
    if (room.players.length < 2) {
      room.status = 'waiting';
    }
  }

  /**
   * Delete a room entirely.
   * @param {string} roomId
   */
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }
}
