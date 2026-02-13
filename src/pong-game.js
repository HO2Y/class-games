import {
  clearMove,
  createInitialState,
  setMove,
  step,
  togglePause
} from './pong-logic.js';
import { getHighScore, SCORE_KEYS, setHighScoreMax } from './highscore.js';

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const leftScoreEl = document.getElementById('leftScore');
const rightScoreEl = document.getElementById('rightScore');
const bestTotalScoreEl = document.getElementById('bestTotalScore');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const dirButtons = Array.from(document.querySelectorAll('button.dir'));

let state = createInitialState();
let bestTotalScore = getHighScore(SCORE_KEYS.pong, 0);
render(state);

const timer = setInterval(() => {
  state = step(state);
  render(state);
}, 16);

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const code = event.code;

  if (key === 'w' || code === 'KeyW') {
    state = setMove(state, 'left', 'up');
  } else if (key === 's' || code === 'KeyS') {
    state = setMove(state, 'left', 'down');
  } else if (key === 'arrowup' || code === 'ArrowUp') {
    event.preventDefault();
    state = setMove(state, 'right', 'up');
  } else if (key === 'arrowdown' || code === 'ArrowDown') {
    event.preventDefault();
    state = setMove(state, 'right', 'down');
  } else if (key === ' ' || key === 'spacebar' || code === 'Space') {
    event.preventDefault();
    state = togglePause(state);
    render(state);
  } else if (key === 'p' || code === 'KeyP') {
    state = togglePause(state);
    render(state);
  } else if (key === 'r') {
    restart();
  }
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  const code = event.code;

  if (key === 'w' || key === 's' || code === 'KeyW' || code === 'KeyS') {
    state = clearMove(state, 'left');
  }
  if (
    key === 'arrowup' ||
    key === 'arrowdown' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown'
  ) {
    state = clearMove(state, 'right');
  }
});

for (const button of dirButtons) {
  const side = button.dataset.side;
  const direction = button.dataset.dir;

  button.addEventListener('pointerdown', () => {
    state = setMove(state, side, direction);
  });

  button.addEventListener('pointerup', () => {
    state = clearMove(state, side);
  });

  button.addEventListener('pointerleave', () => {
    state = clearMove(state, side);
  });
}

pauseBtn.addEventListener('click', () => {
  state = togglePause(state);
  render(state);
});

restartBtn.addEventListener('click', () => {
  restart();
});

window.addEventListener('beforeunload', () => {
  clearInterval(timer);
});

function restart() {
  state = createInitialState();
  render(state);
}

function render(currentState) {
  ctx.clearRect(0, 0, currentState.width, currentState.height);

  ctx.fillStyle = '#ececec';
  ctx.fillRect(0, 0, currentState.width, currentState.height);

  ctx.fillStyle = '#2f855a';
  ctx.fillRect(0, currentState.leftY, currentState.paddleWidth, currentState.paddleHeight);
  ctx.fillRect(
    currentState.width - currentState.paddleWidth,
    currentState.rightY,
    currentState.paddleWidth,
    currentState.paddleHeight
  );

  ctx.fillStyle = '#d64545';
  for (const ball of currentState.balls) {
    ctx.fillRect(ball.x, ball.y, currentState.ballSize, currentState.ballSize);
  }

  leftScoreEl.textContent = String(currentState.leftScore);
  rightScoreEl.textContent = String(currentState.rightScore);
  const totalScore = currentState.leftScore + currentState.rightScore;
  if (totalScore > bestTotalScore) {
    bestTotalScore = setHighScoreMax(SCORE_KEYS.pong, totalScore);
  }
  bestTotalScoreEl.textContent = String(bestTotalScore);
  statusEl.textContent =
    currentState.status === 'paused'
      ? `Paused | Lv ${currentState.speedLevel + 1} | Balls ${currentState.balls.length}`
      : `Running | Lv ${currentState.speedLevel + 1} | Balls ${currentState.balls.length}`;
  pauseBtn.textContent = currentState.status === 'paused' ? 'Resume' : 'Pause';
}
