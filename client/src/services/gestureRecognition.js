/**
 * Simple geometric heuristic to classify gestures from MediaPipe Hands landmarks.
 * Understands Rock, Paper, and Scissors without needing a trained neural network.
 */
export const classifyGesture = (landmarks) => {
  if (!landmarks || landmarks.length !== 21) return 'none';

  // We determine if fingers are "open" by checking if the tip is higher up (smaller Y)
  // than the PIP joint. This assumes the user's hand is pointing upwards relative to the camera.
  
  const isFingerOpen = (tipIdx, pipIdx) => {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
  };

  const indexOpen = isFingerOpen(8, 6);
  const middleOpen = isFingerOpen(12, 10);
  const ringOpen = isFingerOpen(16, 14);
  const pinkyOpen = isFingerOpen(20, 18);

  const openCount = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;

  if (openCount === 0) {
    return 'rock';
  } else if (openCount >= 3) {
    // 3 or 4 fingers open -> paper
    return 'paper';
  } else if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
    return 'scissors';
  }

  return 'none';
};

export const getRandomAIChoice = () => {
  const choices = ['rock', 'paper', 'scissors'];
  const randomIndex = Math.floor(Math.random() * choices.length);
  return choices[randomIndex];
};

export const determineWinner = (userChoice, aiChoice) => {
  if (userChoice === aiChoice) return 'draw';
  
  if (
    (userChoice === 'rock' && aiChoice === 'scissors') ||
    (userChoice === 'paper' && aiChoice === 'rock') ||
    (userChoice === 'scissors' && aiChoice === 'paper')
  ) {
    return 'user';
  }
  
  return 'ai';
};
