export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export const OPPOSITE = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left'
};

export const FRUIT_TYPES = {
  normal: 'normal',
  bonus: 'bonus',
  growth: 'growth',
  slow: 'slow',
  purge: 'purge'
};

export function difficultyLevelForScore(score) {
  return 1 + Math.floor(score / 4);
}

export function createInitialState(options = {}) {
  const cols = options.cols ?? 20;
  const rows = options.rows ?? 20;
  const startX = Math.floor(cols / 2);
  const startY = Math.floor(rows / 2);
  const snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];

  return {
    cols,
    rows,
    snake,
    obstacles: [],
    direction: 'right',
    nextDirection: 'right',
    food: spawnFood(snake, cols, rows, options.rng, [], options.typeRng),
    growthTurns: 0,
    slowTicks: 0,
    score: 0,
    level: 1,
    lastEvent: '',
    status: 'running'
  };
}

export function setDirection(state, direction) {
  if (!DIRECTIONS[direction]) {
    return state;
  }
  if (OPPOSITE[state.direction] === direction) {
    return state;
  }
  return { ...state, nextDirection: direction };
}

export function togglePause(state) {
  if (state.status === 'gameover') {
    return state;
  }
  if (state.status === 'paused') {
    return { ...state, status: 'running' };
  }
  return { ...state, status: 'paused' };
}

export function step(state, options = {}) {
  if (state.status !== 'running') {
    return state;
  }

  const direction = state.nextDirection;
  const velocity = DIRECTIONS[direction];
  const head = state.snake[0];
  const nextHead = { x: head.x + velocity.x, y: head.y + velocity.y };

  if (hitsWall(nextHead, state.cols, state.rows)) {
    return { ...state, direction, status: 'gameover' };
  }

  if (hitsObstacle(nextHead, state.obstacles)) {
    return { ...state, direction, status: 'gameover' };
  }

  const ateFood = pointEq(nextHead, state.food);
  const shouldGrow = ateFood || state.growthTurns > 0;

  const nextSnake = [nextHead, ...state.snake];
  if (!shouldGrow) {
    nextSnake.pop();
  }
  let nextGrowthTurns = state.growthTurns > 0 ? state.growthTurns - 1 : 0;
  let nextSlowTicks = state.slowTicks > 0 ? state.slowTicks - 1 : 0;
  let nextScore = state.score;
  let nextObstacles = state.obstacles ?? [];
  let lastEvent = '';

  if (ateFood) {
    const effect = applyFoodEffect(state.food, state, options.rng);
    nextGrowthTurns += effect.growthTurnsDelta;
    nextSlowTicks = Math.max(nextSlowTicks, effect.slowTicks);
    nextScore += effect.scoreDelta;
    nextObstacles = effect.obstacles;
    lastEvent = effect.event;
  }

  const nextFood = ateFood
    ? spawnFood(
        nextSnake,
        state.cols,
        state.rows,
        options.rng,
        nextObstacles,
        options.typeRng
      )
    : state.food;

  return {
    ...state,
    direction,
    snake: nextSnake,
    obstacles: nextObstacles,
    food: nextFood,
    growthTurns: nextGrowthTurns,
    slowTicks: nextSlowTicks,
    score: nextScore,
    level: difficultyLevelForScore(nextScore),
    lastEvent,
    status: nextFood ? state.status : 'gameover'
  };
}

export function spawnFood(snake, cols, rows, rng = Math.random, obstacles = [], typeRng = Math.random) {
  const spot = placeFood(snake, cols, rows, rng, obstacles);
  if (!spot) {
    return null;
  }
  return {
    ...spot,
    type: pickFruitType(typeRng)
  };
}

export function placeFood(snake, cols, rows, rng = Math.random, obstacles = []) {
  const occupied = new Set(snake.map((segment) => keyFor(segment.x, segment.y)));
  const blocked = new Set(obstacles.map((obstacle) => keyFor(obstacle.x, obstacle.y)));
  const empty = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const key = keyFor(x, y);
      if (!occupied.has(key) && !blocked.has(key)) {
        empty.push({ x, y });
      }
    }
  }

  if (empty.length === 0) {
    return null;
  }

  const index = Math.floor(rng() * empty.length);
  return empty[index];
}

export function hitsWall(point, cols, rows) {
  return point.x < 0 || point.y < 0 || point.x >= cols || point.y >= rows;
}

export function hitsObstacle(point, obstacles) {
  return (obstacles ?? []).some((obstacle) => pointEq(obstacle, point));
}

export function addRandomObstacle(state, rng = Math.random) {
  const occupied = new Set(state.snake.map((segment) => keyFor(segment.x, segment.y)));
  const blocked = new Set(state.obstacles.map((obstacle) => keyFor(obstacle.x, obstacle.y)));
  if (state.food) {
    blocked.add(keyFor(state.food.x, state.food.y));
  }
  const empty = [];

  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      const key = keyFor(x, y);
      if (!occupied.has(key) && !blocked.has(key)) {
        empty.push({ x, y });
      }
    }
  }

  if (empty.length === 0) {
    return state;
  }

  const index = Math.floor(rng() * empty.length);
  return {
    ...state,
    obstacles: [...state.obstacles, empty[index]]
  };
}

export function activateGrowthBoost(state, turns = 5) {
  return {
    ...state,
    growthTurns: Math.max(state.growthTurns, turns)
  };
}

export function expandMap(state, colsDelta = 2, rowsDelta = 2, rng = Math.random) {
  const cols = state.cols + colsDelta;
  const rows = state.rows + rowsDelta;
  const food = state.food ?? spawnFood(state.snake, cols, rows, rng, state.obstacles);
  return {
    ...state,
    cols,
    rows,
    food
  };
}

export function applyFoodEffect(food, state, rng = Math.random) {
  if (!food || !food.type || food.type === FRUIT_TYPES.normal) {
    return {
      scoreDelta: 1,
      growthTurnsDelta: 0,
      slowTicks: 0,
      obstacles: state.obstacles ?? [],
      event: '+1 점수'
    };
  }

  if (food.type === FRUIT_TYPES.bonus) {
    return {
      scoreDelta: 3,
      growthTurnsDelta: 0,
      slowTicks: 0,
      obstacles: state.obstacles ?? [],
      event: '보너스 열매 +3점'
    };
  }

  if (food.type === FRUIT_TYPES.growth) {
    return {
      scoreDelta: 1,
      growthTurnsDelta: 8,
      slowTicks: 0,
      obstacles: state.obstacles ?? [],
      event: '급성장 열매'
    };
  }

  if (food.type === FRUIT_TYPES.slow) {
    return {
      scoreDelta: 1,
      growthTurnsDelta: 0,
      slowTicks: 35,
      obstacles: state.obstacles ?? [],
      event: '슬로우 열매'
    };
  }

  return {
    scoreDelta: 1,
    growthTurnsDelta: 0,
    slowTicks: 0,
    obstacles: removeRandomObstacles(state.obstacles ?? [], 2, rng),
    event: '정화 열매(장애물 제거)'
  };
}

function removeRandomObstacles(obstacles, count, rng) {
  if (obstacles.length === 0 || count <= 0) {
    return obstacles;
  }

  const next = [...obstacles];
  const limit = Math.min(count, next.length);
  for (let i = 0; i < limit; i += 1) {
    const index = Math.floor(rng() * next.length);
    next.splice(index, 1);
  }
  return next;
}

function pickFruitType(rng = Math.random) {
  const roll = rng();
  if (roll < 0.5) {
    return FRUIT_TYPES.normal;
  }
  if (roll < 0.67) {
    return FRUIT_TYPES.bonus;
  }
  if (roll < 0.8) {
    return FRUIT_TYPES.growth;
  }
  if (roll < 0.92) {
    return FRUIT_TYPES.slow;
  }
  return FRUIT_TYPES.purge;
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function pointEq(a, b) {
  return Boolean(a && b) && a.x === b.x && a.y === b.y;
}
