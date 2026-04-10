/**
 * Game Service
 *
 * Core game logic: gesture submission, winner determination,
 * scoring, and round management.
 */

/** Valid gestures and their win conditions */
const GESTURE_BEATS = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

const VALID_GESTURES = Object.keys(GESTURE_BEATS);

export class GameService {
  /**
   * Reset gesture state for a new round.
   * @param {object} room
   */
  resetRound(room) {
    room.players.forEach((player) => {
      player.gesture = null;
      player.ready = false;
    });
  }

  /**
   * Record a player's gesture for the current round.
   * @param {object} room
   * @param {string} socketId
   * @param {string} gesture - 'rock' | 'paper' | 'scissors'
   */
  submitGesture(room, socketId, gesture) {
    const normalizedGesture = gesture.toLowerCase();

    if (!VALID_GESTURES.includes(normalizedGesture)) {
      throw new Error(`Invalid gesture: "${gesture}". Must be rock, paper, or scissors.`);
    }

    const player = room.players.find((p) => p.id === socketId);
    if (player) {
      player.gesture = normalizedGesture;
      player.ready = true;
    }
  }

  /**
   * Check if both players have submitted their gestures.
   * @param {object} room
   * @returns {boolean}
   */
  bothPlayersReady(room) {
    return (
      room.players.length === 2 &&
      room.players.every((p) => p.ready)
    );
  }

  /**
   * Determine the winner of the current round.
   * Updates scores and advances the round counter.
   *
   * @param {object} room
   * @returns {{ winner: string|null, players: Array, round: number, gameOver: boolean }}
   */
  determineWinner(room) {
    const [p1, p2] = room.players;
    let winner = null;
    let winnerId = null;

    if (p1.gesture === p2.gesture) {
      winner = 'draw';
    } else if (GESTURE_BEATS[p1.gesture] === p2.gesture) {
      winner = p1.name;
      winnerId = p1.id;
      p1.score += 1;
    } else {
      winner = p2.name;
      winnerId = p2.id;
      p2.score += 1;
    }

    const result = {
      winner,
      winnerId,
      round: room.currentRound,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        gesture: p.gesture,
        score: p.score,
      })),
      gameOver: room.currentRound >= room.totalRounds,
    };

    // Advance round
    room.currentRound += 1;

    if (result.gameOver) {
      room.status = 'finished';
    }

    return result;
  }
}
