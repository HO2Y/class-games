import {
  activateGrowthBoost,
  addRandomObstacle,
  createInitialState,
  difficultyLevelForScore,
  expandMap,
  FRUIT_TYPES,
  setDirection,
  step,
  togglePause
} from './snake-logic.js';
import { getHighScore, SCORE_KEYS, setHighScoreMax } from './highscore.js';

const BASE_COLS = 20;
const BASE_ROWS = 20;
const BASE_TICK_MS = 140;
const MIN_TICK_MS = 16;
const EXP_GROWTH_RATE = 0.115;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const mapSizeEl = document.getElementById('mapSize');
const statusEl = document.getElementById('status');
const failOverlayEl = document.getElementById('failOverlay');
const failScoreEl = document.getElementById('failScore');
const fxLayerEl = document.getElementById('fxLayer');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const dirButtons = Array.from(document.querySelectorAll('button.dir'));

let cells = [];
let timer = null;
let statusHint = '';
let statusHintTicks = 0;
let combo = 1;
let lastEatAt = 0;
let feverTicks = 0;
let bestScore = getHighScore(SCORE_KEYS.snake, 0);
let state = createInitialState({ cols: BASE_COLS, rows: BASE_ROWS });
rebuildBoard(state.cols, state.rows);
render(state);

scheduleTick();

document.addEventListener('keydown', (event) => {
  const mapped = mapKeyToDirection(event.key);
  if (mapped) {
    event.preventDefault();
    state = setDirection(state, mapped);
    return;
  }

  if (event.key === ' ') {
    event.preventDefault();
    state = togglePause(state);
    if (state.status === 'running') {
      scheduleTick();
    } else {
      clearPendingTick();
    }
    render(state);
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    restart();
  }
});

for (const button of dirButtons) {
  button.addEventListener('click', () => {
    const direction = button.dataset.dir;
    state = setDirection(state, direction);
  });
}

pauseBtn.addEventListener('click', () => {
  state = togglePause(state);
  if (state.status === 'running') {
    scheduleTick();
  } else {
    clearPendingTick();
  }
  render(state);
});

restartBtn.addEventListener('click', () => {
  restart();
});

window.addEventListener('beforeunload', () => {
  clearPendingTick();
});

function restart() {
  clearPendingTick();
  statusHint = '';
  statusHintTicks = 0;
  combo = 1;
  lastEatAt = 0;
  feverTicks = 0;
  state = createInitialState({ cols: BASE_COLS, rows: BASE_ROWS });
  rebuildBoard(state.cols, state.rows);
  failOverlayEl.classList.remove('show');
  boardEl.classList.remove('shake');
  boardEl.classList.remove('fever');
  scheduleTick();
  render(state);
}

function render(currentState) {
  for (const cell of cells) {
    cell.className = 'cell';
    cell.removeAttribute('data-stack');
  }

  if (currentState.food) {
    const foodIdx = indexFor(currentState.food.x, currentState.food.y);
    cells[foodIdx].classList.add('food', foodClassForType(currentState.food.type));
  }

  for (const obstacle of currentState.obstacles) {
    const idx = indexFor(obstacle.x, obstacle.y);
    if (cells[idx]) {
      cells[idx].classList.add('obstacle');
    }
  }

  const stackByCell = new Map();
  for (const segment of currentState.snake) {
    const idx = indexFor(segment.x, segment.y);
    stackByCell.set(idx, (stackByCell.get(idx) ?? 0) + 1);
  }

  for (const [idx, count] of stackByCell.entries()) {
    const cell = cells[idx];
    if (!cell) {
      continue;
    }
    cell.classList.add('snake');
    if (count > 1) {
      cell.classList.add('snake-overlap');
      cell.dataset.stack = String(count);
    }
  }

  scoreEl.textContent = String(currentState.score);
  if (currentState.score > bestScore) {
    bestScore = setHighScoreMax(SCORE_KEYS.snake, currentState.score);
  }
  bestScoreEl.textContent = String(bestScore);
  levelEl.textContent = String(currentState.level);
  comboEl.textContent = `x${combo}`;
  mapSizeEl.textContent = `${currentState.cols} x ${currentState.rows}`;
  statusEl.textContent = statusHint || labelForStatus(currentState.status);
  pauseBtn.textContent = currentState.status === 'paused' ? 'Resume' : 'Pause';

  if (currentState.status === 'gameover') {
    failScoreEl.textContent = `점수 ${currentState.score}`;
    failOverlayEl.classList.add('show');
  } else {
    failOverlayEl.classList.remove('show');
  }
}

function indexFor(x, y) {
  return y * state.cols + x;
}

function mapKeyToDirection(key) {
  switch (key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return 'up';
    case 'arrowdown':
    case 's':
      return 'down';
    case 'arrowleft':
    case 'a':
      return 'left';
    case 'arrowright':
    case 'd':
      return 'right';
    default:
      return null;
  }
}

function labelForStatus(status) {
  switch (status) {
    case 'paused':
      return 'Paused';
    case 'gameover':
      return 'Game Over';
    default:
      return 'Running';
  }
}

function onTick() {
  const previous = state;
  state = step(state);

  if (state.food === null && state.status === 'running') {
    state = { ...state, status: 'gameover' };
  }

  const ateFood = state.score > previous.score;
  if (ateFood && state.status === 'running') {
    onEat(previous.food, previous.score, state.score);
    applyProgressEvents(previous.score, state.score);
    if (state.lastEvent) {
      statusHint = `열매 효과: ${state.lastEvent}`;
      statusHintTicks = 12;
    }
  }

  if (feverTicks > 0) {
    feverTicks -= 1;
    if (feverTicks === 0) {
      boardEl.classList.remove('fever');
      statusHint = 'FEVER 종료';
      statusHintTicks = 10;
    }
  }

  if (statusHintTicks > 0) {
    statusHintTicks -= 1;
    if (statusHintTicks === 0) {
      statusHint = '';
    }
  }

  if (state.cols !== previous.cols || state.rows !== previous.rows) {
    rebuildBoard(state.cols, state.rows);
  }

  render(state);

  if (state.status === 'running') {
    scheduleTick();
  } else {
    triggerShake(260);
    statusHint = 'FAIL';
    statusHintTicks = 16;
    clearPendingTick();
  }
}

function applyProgressEvents(previousScore, currentScore) {
  const notes = [];
  for (let score = previousScore + 1; score <= currentScore; score += 1) {
    if (score % 3 === 0) {
      const before = state.obstacles.length;
      state = addRandomObstacle(state);
      if (state.obstacles.length > before) {
        notes.push('장애물 생성');
      }
    }

    if (score % 5 === 0) {
      state = activateGrowthBoost(state, 5);
      notes.push('급성장 5턴');
    }

    if (score % 7 === 0) {
      state = expandMap(state, 2, 2);
      notes.push('맵 확장');
    }
  }

  if (notes.length > 0) {
    statusHint = `이벤트: ${notes.join(' / ')}`;
    statusHintTicks = 14;
  }
}

function scheduleTick() {
  clearPendingTick();
  const levelTick = computeLevelTickMs(state.level);
  const lengthBonus = Math.min(18, Math.floor(Math.max(0, state.snake.length - 3) / 3));
  const tickMs =
    levelTick -
    lengthBonus +
    (state.slowTicks > 0 ? 45 : 0) -
    (feverTicks > 0 ? 20 : 0);
  timer = setTimeout(onTick, tickMs);
}

function clearPendingTick() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function rebuildBoard(cols, rows) {
  boardEl.innerHTML = '';
  cells = [];
  boardEl.style.setProperty('--cols', String(cols));

  for (let i = 0; i < cols * rows; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cells.push(cell);
    boardEl.append(cell);
  }
}

function foodClassForType(type) {
  switch (type) {
    case FRUIT_TYPES.bonus:
      return 'food-bonus';
    case FRUIT_TYPES.growth:
      return 'food-growth';
    case FRUIT_TYPES.slow:
      return 'food-slow';
    case FRUIT_TYPES.purge:
      return 'food-purge';
    default:
      return 'food-normal';
  }
}

function computeLevelTickMs(level) {
  const clampedLevel = Math.max(1, level);
  const levelOffset = clampedLevel - 1;
  const speedMultiplier = Math.exp(levelOffset * EXP_GROWTH_RATE);
  return Math.max(MIN_TICK_MS, Math.round(BASE_TICK_MS / speedMultiplier));
}

function onEat(food, previousScore, currentScore) {
  const now = performance.now();
  combo = now - lastEatAt < 2200 ? combo + 1 : 1;
  lastEatAt = now;

  const comboBonus = combo > 1 ? combo - 1 : 0;
  if (comboBonus > 0) {
    const boostedScore = currentScore + comboBonus;
    state = {
      ...state,
      score: boostedScore,
      level: difficultyLevelForScore(boostedScore)
    };
    statusHint = `콤보 x${combo}! +${comboBonus} 보너스`;
    statusHintTicks = 10;
  }

  if (combo >= 4) {
    feverTicks = Math.max(feverTicks, 22);
    boardEl.classList.add('fever');
    statusHint = 'FEVER 발동!';
    statusHintTicks = 12;
  }

  if (food) {
    spawnParticles(food.x, food.y, state.cols);
  }

  const gained = state.score - previousScore;
  if (gained >= 3) {
    triggerShake(170);
  }
}

function spawnParticles(x, y, cols) {
  const boardRect = boardEl.getBoundingClientRect();
  const cellSize = boardRect.width / cols;
  const px = x * cellSize + cellSize * 0.5;
  const py = y * cellSize + cellSize * 0.5;

  for (let i = 0; i < 10; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'fx-dot';
    dot.style.left = `${px}px`;
    dot.style.top = `${py}px`;
    dot.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);
    dot.style.setProperty('--dy', `${(Math.random() - 0.5) * 60}px`);
    fxLayerEl.append(dot);
    setTimeout(() => dot.remove(), 520);
  }
}

function triggerShake(durationMs) {
  boardEl.classList.remove('shake');
  requestAnimationFrame(() => {
    boardEl.classList.add('shake');
  });
  setTimeout(() => {
    boardEl.classList.remove('shake');
  }, durationMs);
}
