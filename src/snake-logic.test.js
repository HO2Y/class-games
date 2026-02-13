import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFoodEffect,
  activateGrowthBoost,
  addRandomObstacle,
  createInitialState,
  expandMap,
  FRUIT_TYPES,
  hitsObstacle,
  hitsWall,
  placeFood,
  setDirection,
  spawnFood,
  step
} from './snake-logic.js';

function baseState(overrides = {}) {
  return {
    cols: 8,
    rows: 8,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    obstacles: [],
    direction: 'right',
    nextDirection: 'right',
    food: { x: 7, y: 7, type: FRUIT_TYPES.normal },
    growthTurns: 0,
    slowTicks: 0,
    score: 0,
    level: 1,
    lastEvent: '',
    status: 'running',
    ...overrides
  };
}

test('snake moves one cell per step in current direction', () => {
  const next = step(baseState());
  assert.deepEqual(next.snake, [
    { x: 4, y: 3 },
    { x: 3, y: 3 },
    { x: 2, y: 3 }
  ]);
  assert.equal(next.score, 0);
});

test('snake grows and score increments when food is eaten', () => {
  const state = baseState({ food: { x: 4, y: 3, type: FRUIT_TYPES.normal } });
  const next = step(state, { rng: () => 0, typeRng: () => 0 });

  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 1);
  assert.notDeepEqual(next.food, { x: 4, y: 3, type: FRUIT_TYPES.normal });
});

test('game ends when snake hits a wall', () => {
  const state = baseState({
    cols: 5,
    rows: 5,
    snake: [{ x: 4, y: 2 }],
    food: { x: 1, y: 1, type: FRUIT_TYPES.normal }
  });
  const next = step(state);
  assert.equal(next.status, 'gameover');
});

test('snake can pass through its own body', () => {
  const state = baseState({
    cols: 6,
    rows: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 }
    ],
    direction: 'left',
    nextDirection: 'down',
    food: { x: 4, y: 4, type: FRUIT_TYPES.normal }
  });
  const next = step(state);
  assert.equal(next.status, 'running');
});

test('direction cannot reverse directly', () => {
  const state = baseState({ snake: [{ x: 5, y: 5 }] });
  const next = setDirection(state, 'left');
  assert.equal(next.nextDirection, 'right');
});

test('food is placed on an empty cell', () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 }
  ];
  const food = placeFood(snake, 4, 1, () => 0);
  assert.deepEqual(food, { x: 3, y: 0 });
});

test('food is not placed on obstacle', () => {
  const snake = [{ x: 0, y: 0 }];
  const obstacles = [{ x: 1, y: 0 }];
  const food = placeFood(snake, 3, 1, () => 0, obstacles);
  assert.deepEqual(food, { x: 2, y: 0 });
});

test('spawnFood includes a fruit type', () => {
  const snake = [{ x: 0, y: 0 }];
  const food = spawnFood(snake, 3, 1, () => 0, [], () => 0.6);
  assert.equal(food.type, FRUIT_TYPES.bonus);
});

test('wall detection works', () => {
  assert.equal(hitsWall({ x: -1, y: 0 }, 5, 5), true);
  assert.equal(hitsWall({ x: 0, y: 0 }, 5, 5), false);
});

test('obstacle detection works', () => {
  assert.equal(hitsObstacle({ x: 1, y: 1 }, [{ x: 1, y: 1 }]), true);
  assert.equal(hitsObstacle({ x: 2, y: 2 }, [{ x: 1, y: 1 }]), false);
});

test('game ends when snake hits an obstacle', () => {
  const state = baseState({
    snake: [{ x: 2, y: 2 }],
    obstacles: [{ x: 3, y: 2 }],
    food: { x: 5, y: 5, type: FRUIT_TYPES.normal }
  });
  const next = step(state);
  assert.equal(next.status, 'gameover');
});

test('growth boost increases snake length without eating food', () => {
  let state = baseState();
  state = activateGrowthBoost(state, 2);
  const next = step(state);
  assert.equal(next.snake.length, 4);
  assert.equal(next.growthTurns, 1);
});

test('expandMap increases board size', () => {
  const state = createInitialState({ cols: 10, rows: 10, rng: () => 0, typeRng: () => 0 });
  const next = expandMap(state, 2, 4, () => 0);
  assert.equal(next.cols, 12);
  assert.equal(next.rows, 14);
});

test('addRandomObstacle adds one obstacle on empty cell', () => {
  const state = baseState({
    cols: 4,
    rows: 1,
    snake: [{ x: 0, y: 0 }],
    food: { x: 3, y: 0, type: FRUIT_TYPES.normal }
  });
  const next = addRandomObstacle(state, () => 0);
  assert.equal(next.obstacles.length, 1);
  assert.deepEqual(next.obstacles[0], { x: 1, y: 0 });
});

test('special fruits apply expected effects', () => {
  const base = { obstacles: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] };

  const bonus = applyFoodEffect({ type: FRUIT_TYPES.bonus }, base);
  assert.equal(bonus.scoreDelta, 3);

  const growth = applyFoodEffect({ type: FRUIT_TYPES.growth }, base);
  assert.equal(growth.growthTurnsDelta, 8);

  const slow = applyFoodEffect({ type: FRUIT_TYPES.slow }, base);
  assert.equal(slow.slowTicks, 35);

  const purge = applyFoodEffect({ type: FRUIT_TYPES.purge }, base, () => 0);
  assert.equal(purge.obstacles.length, 1);
});

test('initial state is valid', () => {
  const state = createInitialState({ cols: 10, rows: 10, rng: () => 0, typeRng: () => 0 });
  assert.equal(state.snake.length, 3);
  assert.equal(state.status, 'running');
  assert.equal(state.score, 0);
  assert.ok(state.food);
});
