export const DIFFICULTY_TICK_INTERVAL = 600;
export const SPEED_INCREASE_PER_LEVEL = 0.18;
export const PADDLE_SPEED_INCREASE_PER_LEVEL = 0.08;

export function createInitialState() {
  const width = 480;
  const height = 320;
  const ballSize = 10;
  const baseBallSpeed = 4;
  const initialBall = createSpawnBall({
    width,
    height,
    ballSize,
    speed: baseBallSpeed,
    direction: 1,
    seed: 0
  });

  return {
    width,
    height,
    paddleHeight: 64,
    paddleWidth: 10,
    paddleSpeed: 6,
    ballSize,
    baseBallSpeed,
    leftY: 128,
    rightY: 128,
    leftMove: 0,
    rightMove: 0,
    balls: [initialBall],
    leftScore: 0,
    rightScore: 0,
    status: 'running',
    ticks: 0,
    speedLevel: 0
  };
}

export function setMove(state, side, dir) {
  const move = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  if (side === 'left') {
    return { ...state, leftMove: move };
  }
  if (side === 'right') {
    return { ...state, rightMove: move };
  }
  return state;
}

export function clearMove(state, side) {
  if (side === 'left') {
    return { ...state, leftMove: 0 };
  }
  if (side === 'right') {
    return { ...state, rightMove: 0 };
  }
  return state;
}

export function togglePause(state) {
  if (state.status === 'paused') {
    return { ...state, status: 'running' };
  }
  if (state.status === 'running') {
    return { ...state, status: 'paused' };
  }
  return state;
}

export function step(state) {
  if (state.status !== 'running') {
    return state;
  }

  const leftY = clamp(
    state.leftY + state.leftMove * paddleSpeedForLevel(state.paddleSpeed, state.speedLevel),
    0,
    state.height - state.paddleHeight
  );

  const rightY = clamp(
    state.rightY + state.rightMove * paddleSpeedForLevel(state.paddleSpeed, state.speedLevel),
    0,
    state.height - state.paddleHeight
  );

  const ticks = state.ticks + 1;
  const nextSpeedLevel = Math.floor(ticks / DIFFICULTY_TICK_INTERVAL);
  const previousSpeed = speedForLevel(state.baseBallSpeed, state.speedLevel);
  const currentSpeed = speedForLevel(state.baseBallSpeed, nextSpeedLevel);
  const speedRatio = previousSpeed === 0 ? 1 : currentSpeed / previousSpeed;

  let balls =
    speedRatio === 1
      ? state.balls
      : state.balls.map((ball) => ({
          ...ball,
          vx: ball.vx * speedRatio,
          vy: ball.vy * speedRatio
        }));

  let leftScore = state.leftScore;
  let rightScore = state.rightScore;

  balls = balls.map((ball, index) => {
    const result = stepBall({
      ball,
      index,
      state,
      leftY,
      rightY,
      speed: currentSpeed
    });
    leftScore += result.leftScoreDelta;
    rightScore += result.rightScoreDelta;
    return result.ball;
  });

  return {
    ...state,
    leftY,
    rightY,
    balls,
    leftScore,
    rightScore,
    ticks,
    speedLevel: nextSpeedLevel
  };
}

function stepBall({ ball, index, state, leftY, rightY, speed }) {
  let x = ball.x + ball.vx;
  let y = ball.y + ball.vy;
  let vx = ball.vx;
  let vy = ball.vy;
  let leftScoreDelta = 0;
  let rightScoreDelta = 0;

  if (y <= 0 || y + state.ballSize >= state.height) {
    vy *= -1;
    y = clamp(y, 0, state.height - state.ballSize);
  }

  const leftPaddleHit =
    x <= state.paddleWidth &&
    y + state.ballSize >= leftY &&
    y <= leftY + state.paddleHeight;

  const rightPaddleX = state.width - state.paddleWidth;
  const rightPaddleHit =
    x + state.ballSize >= rightPaddleX &&
    y + state.ballSize >= rightY &&
    y <= rightY + state.paddleHeight;

  if (leftPaddleHit && vx < 0) {
    vx = Math.abs(vx);
    x = state.paddleWidth;
    ({ vx, vy } = normalizeVelocity(vx, vy, speed));
  }

  if (rightPaddleHit && vx > 0) {
    vx = -Math.abs(vx);
    x = rightPaddleX - state.ballSize;
    ({ vx, vy } = normalizeVelocity(vx, vy, speed));
  }

  if (x + state.ballSize < 0) {
    rightScoreDelta += 1;
    return {
      ball: createSpawnBall({
        width: state.width,
        height: state.height,
        ballSize: state.ballSize,
        speed,
        direction: -1,
        seed: index
      }),
      leftScoreDelta,
      rightScoreDelta
    };
  }

  if (x > state.width) {
    leftScoreDelta += 1;
    return {
      ball: createSpawnBall({
        width: state.width,
        height: state.height,
        ballSize: state.ballSize,
        speed,
        direction: 1,
        seed: index
      }),
      leftScoreDelta,
      rightScoreDelta
    };
  }

  return {
    ball: { x, y, vx, vy },
    leftScoreDelta,
    rightScoreDelta
  };
}

function speedForLevel(baseSpeed, level) {
  return baseSpeed * (1 + level * SPEED_INCREASE_PER_LEVEL);
}

function paddleSpeedForLevel(baseSpeed, level) {
  return baseSpeed * (1 + level * PADDLE_SPEED_INCREASE_PER_LEVEL);
}

function createSpawnBall({ width, height, ballSize, speed, direction, seed }) {
  const angleOptions = [0.35, 0.55, 0.75];
  const angle = angleOptions[seed % angleOptions.length];
  const verticalDir = seed % 2 === 0 ? 1 : -1;
  return {
    x: (width - ballSize) / 2,
    y: (height - ballSize) / 2,
    vx: speed * direction,
    vy: speed * angle * verticalDir
  };
}

function normalizeVelocity(vx, vy, speed) {
  const magnitude = Math.hypot(vx, vy);
  if (magnitude === 0) {
    return { vx: speed, vy: 0 };
  }
  const scale = speed / magnitude;
  return {
    vx: vx * scale,
    vy: vy * scale
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
