import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BALL_ADD_TICK_INTERVAL,
  DIFFICULTY_TICK_INTERVAL,
  createInitialState,
  setMove,
  step,
  togglePause
} from './pong-logic.js';

test('paddle moves within bounds', () => {
  let state = createInitialState();
  state = { ...state, leftY: 0 };
  state = setMove(state, 'left', 'up');
  state = step(state);
  assert.equal(state.leftY, 0);
});

test('ball bounces on top and bottom walls', () => {
  let state = createInitialState();
  state = { ...state, balls: [{ x: 100, y: 0, vx: 4, vy: -4 }] };
  state = step(state);
  assert.equal(state.balls[0].vy > 0, true);

  state = {
    ...state,
    balls: [{ x: 100, y: state.height - state.ballSize, vx: 4, vy: 4 }]
  };
  state = step(state);
  assert.equal(state.balls[0].vy < 0, true);
});

test('left paddle collision reverses ball x direction', () => {
  let state = createInitialState();
  state = {
    ...state,
    balls: [{ x: 8, y: state.leftY + 10, vx: -4, vy: 0 }]
  };
  state = step(state);
  assert.equal(state.balls[0].vx > 0, true);
});

test('scoring increments when ball leaves screen', () => {
  let state = createInitialState();
  state = { ...state, balls: [{ x: -20, y: 0, vx: -4, vy: 0 }] };
  state = step(state);
  assert.equal(state.rightScore, 1);

  state = { ...state, balls: [{ x: state.width + 1, y: 0, vx: 4, vy: 0 }] };
  state = step(state);
  assert.equal(state.leftScore, 1);
});

test('difficulty level increases over time and ball speed gets faster', () => {
  let state = createInitialState();
  const initialSpeed = Math.abs(state.balls[0].vx);

  for (let i = 0; i < DIFFICULTY_TICK_INTERVAL; i += 1) {
    state = step(state);
  }

  assert.equal(state.speedLevel, 1);
  assert.equal(Math.abs(state.balls[0].vx) > initialSpeed, true);
});

test('new balls are added over time', () => {
  let state = createInitialState();
  for (let i = 0; i < BALL_ADD_TICK_INTERVAL; i += 1) {
    state = step(state);
  }

  assert.equal(state.balls.length, 2);
});

test('pause toggles state and stops movement while paused', () => {
  let state = createInitialState();
  const before = state.balls[0].x;

  state = togglePause(state);
  assert.equal(state.status, 'paused');

  state = step(state);
  assert.equal(state.balls[0].x, before);

  state = togglePause(state);
  assert.equal(state.status, 'running');
});
