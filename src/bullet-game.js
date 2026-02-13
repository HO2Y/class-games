import { getHighScore, SCORE_KEYS, setHighScoreMax } from './highscore.js';

const canvas = document.getElementById('bulletCanvas');
const ctx = canvas.getContext('2d');

const timeAliveEl = document.getElementById('timeAlive');
const bestTimeAliveEl = document.getElementById('bestTimeAlive');
const dangerLevelEl = document.getElementById('dangerLevel');
const grazeCountEl = document.getElementById('grazeCount');
const statusEl = document.getElementById('status');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const failOverlayEl = document.getElementById('bulletFailOverlay');
const failTextEl = document.getElementById('bulletFailText');
const diffButtons = Array.from(document.querySelectorAll('.difficulty-btn'));

const keys = new Set();
const particles = [];
const bullets = [];
const shockwaves = [];
const BULLET_TYPES = ['orb', 'flower', 'face', 'kitty', 'plane', 'missile', 'car'];
const DIFFICULTY_PRESETS = {
  easy: {
    label: 'Easy',
    playerSpeed: 280,
    dangerDivisor: 33,
    spawnMultiplier: 0.72,
    speedMultiplier: 0.78
  },
  normal: {
    label: 'Normal',
    playerSpeed: 265,
    dangerDivisor: 25,
    spawnMultiplier: 1,
    speedMultiplier: 1
  },
  hard: {
    label: 'Hard',
    playerSpeed: 252,
    dangerDivisor: 21,
    spawnMultiplier: 1.32,
    speedMultiplier: 1.2
  },
  insane: {
    label: 'Insane',
    playerSpeed: 244,
    dangerDivisor: 17,
    spawnMultiplier: 1.65,
    speedMultiplier: 1.44
  }
};

const player = {
  x: canvas.width / 2,
  y: canvas.height * 0.8,
  radius: 7,
  speed: 280
};

let spiralAngle = 0;
let wavePhase = 0;
let lastTime = performance.now();
let spawnAccumulator = 0;
let elapsed = 0;
let grazeCount = 0;
let status = 'running';
let stage = 0;
let screenShake = 0;
let flashAlpha = 0;
let presetKey = 'easy';
let bestTime = getHighScore(SCORE_KEYS.bullet, 0);
let gimmick = null;
let gimmickCooldown = rand(10, 16);
let rainAccumulator = 0;

renderFrame(0);
requestAnimationFrame(loop);

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const code = event.code;

  if (
    key === 'w' ||
    key === 'a' ||
    key === 's' ||
    key === 'd' ||
    key === 'arrowup' ||
    key === 'arrowdown' ||
    key === 'arrowleft' ||
    key === 'arrowright' ||
    code === 'ShiftLeft' ||
    code === 'ShiftRight'
  ) {
    keys.add(key);
    keys.add(code);
  }

  if (key === ' ' || code === 'Space') {
    event.preventDefault();
    togglePause();
  }

  if (key === 'r') {
    resetGame();
  }
});

document.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
  keys.delete(event.code);
});

pauseBtn.addEventListener('click', () => {
  togglePause();
});

restartBtn.addEventListener('click', () => {
  resetGame();
});

for (const button of diffButtons) {
  button.addEventListener('click', () => {
    const key = button.dataset.diff;
    if (!DIFFICULTY_PRESETS[key]) {
      return;
    }
    applyPreset(key);
    resetGame();
  });
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (status === 'running') {
    elapsed += dt;
    handleStageTransition();
    updateGimmick(dt);
    updatePlayer(dt);
    spawnBullets(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateShockwaves(dt);
    detectCollisions();
  }

  screenShake = Math.max(0, screenShake - dt * 3.2);
  flashAlpha = Math.max(0, flashAlpha - dt * 2.1);

  renderFrame(dt);
  requestAnimationFrame(loop);
}

function togglePause() {
  if (status === 'gameover') {
    return;
  }
  status = status === 'paused' ? 'running' : 'paused';
  statusEl.textContent = status === 'paused' ? 'Paused' : 'Running';
  pauseBtn.textContent = status === 'paused' ? 'Resume' : 'Pause';
}

function resetGame() {
  bullets.length = 0;
  particles.length = 0;
  player.x = canvas.width / 2;
  player.y = canvas.height * 0.8;
  elapsed = 0;
  grazeCount = 0;
  spawnAccumulator = 0;
  spiralAngle = 0;
  wavePhase = 0;
  stage = 0;
  screenShake = 0;
  flashAlpha = 0;
  gimmick = null;
  gimmickCooldown = rand(10, 16);
  rainAccumulator = 0;
  status = 'running';
  statusEl.textContent = 'Running';
  pauseBtn.textContent = 'Pause';
  failOverlayEl.classList.remove('show');
}

function updatePlayer(dt) {
  let vx = 0;
  let vy = 0;

  if (keys.has('w') || keys.has('arrowup')) vy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) vy += 1;
  if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
  if (keys.has('d') || keys.has('arrowright')) vx += 1;

  const speedScale = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 0.45 : 1;
  const mag = Math.hypot(vx, vy) || 1;
  const speed = player.speed * speedScale;

  player.x += (vx / mag) * speed * dt;
  player.y += (vy / mag) * speed * dt;

  player.x = clamp(player.x, player.radius, canvas.width - player.radius);
  player.y = clamp(player.y, player.radius, canvas.height - player.radius);
}

function spawnBullets(dt) {
  const danger = dangerLevel();
  const spawnScale = DIFFICULTY_PRESETS[presetKey].spawnMultiplier;
  const gimmickSpawnBoost =
    gimmick?.type === 'storm' ? 1.28 : gimmick?.type === 'rain' ? 1.16 : 1;
  const spawnsPerSecond = clamp(
    (1.2 * danger + 0.28 * Math.pow(danger, 1.45)) * spawnScale * gimmickSpawnBoost,
    1.2,
    48
  );
  spawnAccumulator += dt * spawnsPerSecond;

  while (spawnAccumulator >= 1) {
    spawnAccumulator -= 1;
    spawnPattern(danger);
  }
}

function spawnPattern(danger) {
  const roll = Math.random();
  if (roll < 0.26) {
    spawnRingBurst(danger);
  } else if (roll < 0.5) {
    spawnSpiralStream(danger);
  } else if (roll < 0.74) {
    spawnWaveFan(danger);
  } else {
    spawnHunterVolley(danger);
  }

  if (danger > 7 && Math.random() < clamp((danger - 7) * 0.045, 0, 0.45)) {
    spawnWaveFan(danger * 0.85);
  }
}

function spawnRingBurst(danger) {
  const count = Math.min(48, 6 + Math.floor(Math.pow(danger, 1.05) * 2.2));
  const centerX = rand(90, canvas.width - 90);
  const centerY = rand(70, canvas.height - 220);
  const speed = scaledSpeed(danger, 1);
  const kind = randomBulletKind(danger);

  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + rand(-0.07, 0.07);
    createBullet(
      centerX,
      centerY,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      rand(2.2, 4.6),
      hueForDanger(danger),
      kind
    );
  }
}

function spawnSpiralStream(danger) {
  const originX = Math.random() < 0.5 ? 0 : canvas.width;
  const originY = rand(40, canvas.height - 40);
  const baseAngle = originX === 0 ? 0 : Math.PI;
  const stream = 2 + Math.floor(Math.pow(danger, 0.95) * 0.9);
  const speed = scaledSpeed(danger, 1.25);

  for (let i = 0; i < stream; i += 1) {
    const a = baseAngle + Math.sin(spiralAngle + i * 0.4) * 0.85;
    const kind = i % 2 === 0 ? 'flower' : randomBulletKind(danger);
    createBullet(
      originX,
      originY,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      rand(2.6, 5.4),
      hueForDanger(danger + i * 0.2),
      kind
    );
  }
  spiralAngle += 0.38;
}

function spawnWaveFan(danger) {
  const fromTop = Math.random() < 0.6;
  const y = fromTop ? 0 : canvas.height;
  const dir = fromTop ? 1 : -1;
  const count = 5 + Math.floor(Math.pow(danger, 1.03) * 1.3);
  const speed = scaledSpeed(danger, 1.05);

  for (let i = 0; i < count; i += 1) {
    const x = ((i + 0.5) / count) * canvas.width;
    const a = wavePhase + i * 0.35;
    const vx = Math.sin(a) * speed * 0.9;
    const vy = dir * speed;
    createBullet(
      x,
      y,
      vx,
      vy,
      rand(2.1, 4.8),
      hueForDanger(danger + Math.sin(a) * 0.7),
      randomBulletKind(danger)
    );
  }
  wavePhase += 0.55;
}

function spawnHunterVolley(danger) {
  const count = Math.min(18, 2 + Math.floor(danger * 0.85));
  const speed = scaledSpeed(danger, 1.35);

  for (let i = 0; i < count; i += 1) {
    const edge = Math.floor(rand(0, 4));
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = rand(0, canvas.width);
      y = -8;
    } else if (edge === 1) {
      x = rand(0, canvas.width);
      y = canvas.height + 8;
    } else if (edge === 2) {
      x = -8;
      y = rand(0, canvas.height);
    } else {
      x = canvas.width + 8;
      y = rand(0, canvas.height);
    }

    const dx = player.x - x;
    const dy = player.y - y;
    const d = Math.hypot(dx, dy) || 1;
    const spread = rand(-0.28, 0.28);
    const baseAngle = Math.atan2(dy, dx) + spread;
    const kind =
      Math.random() < 0.35
        ? 'missile'
        : Math.random() < 0.55
          ? 'plane'
          : Math.random() < 0.75
            ? 'car'
            : 'face';

    createBullet(
      x,
      y,
      Math.cos(baseAngle) * speed,
      Math.sin(baseAngle) * speed,
      kind === 'missile' ? rand(3.5, 6.2) : kind === 'plane' ? rand(3.4, 6.8) : rand(2.8, 5.5),
      hueForDanger(danger + i * 0.1),
      kind
    );
  }
}

function createBullet(x, y, vx, vy, radius, hue, type = 'orb') {
  const sizeScale = bulletSizeScale(type);
  const giantScale = giantScaleFor(dangerLevel(), type);
  const finalRadius = radius * sizeScale * giantScale;
  const isGiant = giantScale > 1.9;
  const shiftedHue = normalizeHue(hue + rand(-80, 80) + stage * 18);
  const sat = rand(72, 100);
  const light = rand(56, 78);
  const hitScale =
    type === 'plane'
      ? 1.45
      : type === 'missile'
        ? 1.38
        : type === 'car'
          ? 1.42
          : type === 'kitty'
            ? 1.32
          : type === 'flower'
            ? 1.2
            : 1;
  bullets.push({
    x,
    y,
    vx,
    vy,
    radius: finalRadius,
    hitRadius: finalRadius * hitScale,
    hue: shiftedHue,
    sat,
    light,
    type,
    isGiant,
    spin: rand(0, Math.PI * 2),
    age: 0,
    life: clamp(6.5 + finalRadius * 0.35, 6.5, 10)
  });
}

function updateBullets(dt) {
  const speedFactor = gimmick?.type === 'slowfield' ? 0.72 : 1;

  for (const b of bullets) {
    b.age += dt;
    b.x += b.vx * dt * speedFactor;
    b.y += b.vy * dt * speedFactor;

    if (elapsed > 25) {
      b.vx += Math.sin(b.age * 4 + b.hue * 0.05) * 8 * dt;
      b.vy += Math.cos(b.age * 3 + b.hue * 0.06) * 8 * dt;
    }

    if (b.type === 'plane') {
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const nx = -b.vy / speed;
      const ny = b.vx / speed;
      const wave = Math.sin((b.age + b.spin) * 9) * 12;
      b.x += nx * wave * dt;
      b.y += ny * wave * dt;
    }
    if (b.type === 'car') {
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const nx = -b.vy / speed;
      const ny = b.vx / speed;
      const drift = Math.sin((b.age + b.spin) * 5.5) * 8;
      b.x += nx * drift * dt;
      b.y += ny * drift * dt;
    }

    if (b.type === 'missile' || elapsed > 45) {
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const turn = b.type === 'missile' ? 20 : 5;
      b.vx += (dx / d) * turn * dt;
      b.vy += (dy / d) * turn * dt;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    if (
      b.age > b.life ||
      b.x < -80 ||
      b.x > canvas.width + 80 ||
      b.y < -80 ||
      b.y > canvas.height + 80
    ) {
      bullets.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    if (particles[i].age > particles[i].life) {
      particles.splice(i, 1);
    }
  }
}

function detectCollisions() {
  for (const b of bullets) {
    const d = Math.hypot(player.x - b.x, player.y - b.y);
    const hitDist = player.radius + b.hitRadius;

    if (d <= hitDist) {
      onFail();
      return;
    }

    if (d <= hitDist + 7 && !b.grazed) {
      b.grazed = true;
      grazeCount += 1;
      spawnGrazeParticles(b.x, b.y, b.hue);
      screenShake = Math.max(screenShake, 0.16);
      flashAlpha = Math.max(flashAlpha, 0.18);
      if (grazeCount % 20 === 0) {
        triggerShockwave();
      }
    }
  }
}

function onFail() {
  status = 'gameover';
  statusEl.textContent = 'FAIL';
  failTextEl.textContent = `생존 ${elapsed.toFixed(1)}s / 근접 회피 ${grazeCount}`;
  failOverlayEl.classList.add('show');
  screenShake = 0.7;
  flashAlpha = 0.42;
  spawnGrazeParticles(player.x, player.y, 10);
}

function renderFrame() {
  const danger = dangerLevel();
  const s = screenShake * screenShake * 8;
  const ox = rand(-s, s);
  const oy = rand(-s, s);

  ctx.save();
  ctx.translate(ox, oy);

  drawBackgroundForStage(danger, stage);
  drawGimmickOverlay();
  drawBullets();
  drawShockwaves();
  drawParticles();
  drawPlayer();
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(-16, -16, canvas.width + 32, canvas.height + 32);
  }

  ctx.restore();

  timeAliveEl.textContent = `${elapsed.toFixed(1)}s`;
  if (elapsed > bestTime && status === 'running') {
    bestTime = setHighScoreMax(SCORE_KEYS.bullet, elapsed);
  }
  bestTimeAliveEl.textContent = `${bestTime.toFixed(1)}s`;
  dangerLevelEl.textContent = String(Math.floor(danger));
  grazeCountEl.textContent = String(grazeCount);
  if (status === 'running') {
    const gimmickLabel = gimmick ? ` | Gimmick: ${gimmickLabelFor(gimmick.type)}` : '';
    statusEl.textContent = `Running | ${stageName(stage)} | ${DIFFICULTY_PRESETS[presetKey].label}${gimmickLabel}`;
  }
}

function drawBullets() {
  for (const b of bullets) {
    const trailAlpha = clamp(0.08 + b.age * 0.03, 0.08, 0.24);
    const hue = normalizeHue(b.hue + Math.sin(elapsed * 4 + b.spin) * 10);
    ctx.strokeStyle = `hsla(${hue} ${b.sat}% ${b.light}% / ${trailAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.04, b.y - b.vy * 0.04);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (b.isGiant) {
      const ring = 1 + Math.sin(elapsed * 8 + b.spin) * 0.12;
      ctx.strokeStyle = `hsla(${hue} 100% 80% / 0.65)`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.1 * ring, 0, Math.PI * 2);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3.6);
    glow.addColorStop(0, `hsla(${hue} 100% 80% / 0.95)`);
    glow.addColorStop(1, `hsla(${hue} 100% 55% / 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 3.6, 0, Math.PI * 2);
    ctx.fill();

    drawBulletShape(b);
  }
}

function drawBulletShape(b) {
  const hue = normalizeHue(b.hue + Math.sin(elapsed * 3 + b.spin) * 8);

  if (b.type === 'flower') {
    const petals = 6;
    for (let i = 0; i < petals; i += 1) {
      const a = b.spin + b.age * 2 + (Math.PI * 2 * i) / petals;
      const px = b.x + Math.cos(a) * b.radius * 1.8;
      const py = b.y + Math.sin(a) * b.radius * 1.8;
      ctx.fillStyle = `hsla(${hue + 30} 92% 66% / 0.95)`;
      ctx.beginPath();
      ctx.arc(px, py, b.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `hsl(${hue - 20} 92% 76%)`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (b.type === 'face') {
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(b.x - b.radius * 0.45, b.y - b.radius * 0.2, b.radius * 0.18, 0, Math.PI * 2);
    ctx.arc(b.x + b.radius * 0.45, b.y - b.radius * 0.2, b.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(b.x, b.y + b.radius * 0.12, b.radius * 0.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    return;
  }

  if (b.type === 'kitty') {
    const headR = b.radius * 1.35;
    const earR = b.radius * 0.62;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, headR, 0, Math.PI * 2);
    ctx.arc(b.x - headR * 0.72, b.y - headR * 0.78, earR, 0, Math.PI * 2);
    ctx.arc(b.x + headR * 0.72, b.y - headR * 0.78, earR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(b.x - headR * 0.38, b.y - headR * 0.08, b.radius * 0.18, 0, Math.PI * 2);
    ctx.arc(b.x + headR * 0.38, b.y - headR * 0.08, b.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + headR * 0.2, b.radius * 0.24, b.radius * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(b.x - headR * 0.56, b.y + headR * 0.08);
    ctx.lineTo(b.x - headR * 0.9, b.y + headR * 0.02);
    ctx.moveTo(b.x - headR * 0.56, b.y + headR * 0.22);
    ctx.lineTo(b.x - headR * 0.9, b.y + headR * 0.26);
    ctx.moveTo(b.x + headR * 0.56, b.y + headR * 0.08);
    ctx.lineTo(b.x + headR * 0.9, b.y + headR * 0.02);
    ctx.moveTo(b.x + headR * 0.56, b.y + headR * 0.22);
    ctx.lineTo(b.x + headR * 0.9, b.y + headR * 0.26);
    ctx.stroke();

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(b.x + headR * 0.78, b.y - headR * 0.74, b.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (b.type === 'plane' || b.type === 'missile' || b.type === 'car') {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    if (b.type === 'plane') {
      ctx.fillStyle = `hsl(${hue} 90% 70%)`;
      ctx.beginPath();
      ctx.moveTo(b.radius * 1.8, 0);
      ctx.lineTo(-b.radius * 1.2, b.radius * 0.9);
      ctx.lineTo(-b.radius * 0.8, 0);
      ctx.lineTo(-b.radius * 1.2, -b.radius * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-b.radius * 1.1, -b.radius * 0.25, b.radius * 1.2, b.radius * 0.5);
    } else if (b.type === 'missile') {
      ctx.fillStyle = `hsl(${hue} 95% 68%)`;
      ctx.beginPath();
      ctx.rect(-b.radius * 1.4, -b.radius * 0.55, b.radius * 2.6, b.radius * 1.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.radius * 1.2, 0, b.radius * 0.55, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(-b.radius * 1.45, 0);
      ctx.lineTo(-b.radius * 2.2, b.radius * 0.35);
      ctx.lineTo(-b.radius * 2.2, -b.radius * 0.35);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = `hsl(${hue} 85% 62%)`;
      ctx.fillRect(-b.radius * 1.7, -b.radius * 0.75, b.radius * 3.2, b.radius * 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-b.radius * 0.9, -b.radius * 0.45, b.radius * 1.1, b.radius * 0.45);
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-b.radius * 0.95, b.radius * 0.86, b.radius * 0.38, 0, Math.PI * 2);
      ctx.arc(b.radius * 0.95, b.radius * 0.86, b.radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = `hsl(${hue} 95% 67%)`;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const core = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.radius * 4);
  core.addColorStop(0, 'rgba(255,255,255,0.98)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackgroundForStage(danger, mapStage) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  if (mapStage === 0) {
    gradient.addColorStop(0, `hsl(${205 + danger * 2} 42% 12%)`);
    gradient.addColorStop(1, `hsl(${242 + danger * 2} 54% 8%)`);
  } else if (mapStage === 1) {
    gradient.addColorStop(0, `hsl(${287} 40% 14%)`);
    gradient.addColorStop(1, `hsl(${330} 55% 10%)`);
  } else if (mapStage === 2) {
    gradient.addColorStop(0, `hsl(190 55% 11%)`);
    gradient.addColorStop(1, `hsl(250 60% 9%)`);
  } else {
    gradient.addColorStop(0, 'hsl(0 0% 8%)');
    gradient.addColorStop(1, 'hsl(260 24% 6%)');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(-16, -16, canvas.width + 32, canvas.height + 32);
  drawStarfield(danger);

  if (mapStage >= 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const gap = mapStage === 1 ? 56 : 42;
    for (let x = -16; x < canvas.width + 16; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, -16);
      ctx.lineTo(x, canvas.height + 16);
      ctx.stroke();
    }
  }

  if (mapStage >= 2) {
    const r = 80 + Math.sin(elapsed * 1.8) * 20;
    ctx.strokeStyle = 'rgba(92, 238, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, r + mapStage * 12, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStarfield(danger) {
  const count = 26 + Math.floor(danger * 1.8);
  for (let i = 0; i < count; i += 1) {
    const x = ((i * 73 + elapsed * (8 + danger * 0.4)) % (canvas.width + 60)) - 30;
    const y = ((i * 41 + elapsed * (14 + danger * 0.7)) % (canvas.height + 60)) - 30;
    const alpha = 0.15 + ((i % 9) / 9) * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.45})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
}

function drawGimmickOverlay() {
  if (!gimmick) {
    return;
  }

  if (gimmick.type === 'slowfield') {
    const r = 95 + Math.sin(elapsed * 5) * 8;
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (gimmick.type === 'storm') {
    ctx.fillStyle = 'rgba(255, 120, 220, 0.08)';
    ctx.fillRect(-16, -16, canvas.width + 32, canvas.height + 32);
  }
}

function drawParticles() {
  for (const p of particles) {
    const t = 1 - p.age / p.life;
    ctx.fillStyle = `hsla(${p.hue} 100% 72% / ${t})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShockwaves() {
  for (const w of shockwaves) {
    const t = 1 - w.age / w.life;
    ctx.strokeStyle = `hsla(${w.hue} 100% 72% / ${t * 0.9})`;
    ctx.lineWidth = 2 + (1 - t) * 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius * (1 - t), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function spawnGrazeParticles(x, y, hue) {
  for (let i = 0; i < 8; i += 1) {
    const a = rand(0, Math.PI * 2);
    const speed = rand(30, 110);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: rand(1.4, 3.1),
      hue,
      age: 0,
      life: rand(0.2, 0.45)
    });
  }
}

function dangerLevel() {
  const divisor = DIFFICULTY_PRESETS[presetKey].dangerDivisor;
  return clamp(Math.exp(elapsed / divisor), 1, 40);
}

function hueForDanger(danger) {
  return 180 + Math.min(170, danger * 11 + Math.sin(elapsed * 0.8) * 14);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scaledSpeed(danger, factor) {
  const presetScale = DIFFICULTY_PRESETS[presetKey].speedMultiplier;
  return clamp((50 + 17 * Math.pow(danger, 1.2)) * factor * presetScale, 70, 820);
}

function randomBulletKind(danger) {
  if (danger < 2.2) {
    return Math.random() < 0.8 ? 'orb' : 'flower';
  }
  if (danger < 5.2) {
    return BULLET_TYPES[Math.floor(rand(0, 3))];
  }
  if (danger < 9.5) {
    return BULLET_TYPES[Math.floor(rand(0, 6))];
  }
  return BULLET_TYPES[Math.floor(rand(0, BULLET_TYPES.length))];
}

function bulletSizeScale(type) {
  if (type === 'plane') {
    return rand(1.0, 1.85);
  }
  if (type === 'missile') {
    return rand(1.0, 1.7);
  }
  if (type === 'car') {
    return rand(1.05, 1.9);
  }
  if (type === 'face') {
    return rand(0.9, 1.45);
  }
  if (type === 'kitty') {
    return rand(1.0, 1.55);
  }
  if (type === 'flower') {
    return rand(0.85, 1.35);
  }
  return rand(0.8, 1.3);
}

function giantScaleFor(danger, type) {
  const typeBonus =
    type === 'plane' || type === 'missile' || type === 'car'
      ? 0.02
      : type === 'kitty'
        ? 0.018
        : 0.012;
  const chance = clamp(0.015 + danger * typeBonus, 0.015, 0.16);
  if (Math.random() > chance) {
    return 1;
  }
  return rand(2.1, 3.4);
}

function applyPreset(key) {
  presetKey = key;
  player.speed = DIFFICULTY_PRESETS[key].playerSpeed;
  for (const button of diffButtons) {
    button.classList.toggle('active', button.dataset.diff === key);
  }
}

function triggerShockwave() {
  shockwaves.push({
    x: player.x,
    y: player.y,
    radius: 180,
    hue: 165,
    age: 0,
    life: 0.42
  });
  screenShake = Math.max(screenShake, 0.42);
  flashAlpha = Math.max(flashAlpha, 0.26);

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    const d = Math.hypot(b.x - player.x, b.y - player.y);
    if (d < 120) {
      spawnGrazeParticles(b.x, b.y, b.hue);
      bullets.splice(i, 1);
    }
  }
}

function updateShockwaves(dt) {
  for (const w of shockwaves) {
    w.age += dt;
  }
  for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
    if (shockwaves[i].age > shockwaves[i].life) {
      shockwaves.splice(i, 1);
    }
  }
}

function stageForDanger(danger) {
  if (danger < 3) return 0;
  if (danger < 8) return 1;
  if (danger < 16) return 2;
  return 3;
}

function stageName(mapStage) {
  if (mapStage === 0) return 'Nebula';
  if (mapStage === 1) return 'Crimson Grid';
  if (mapStage === 2) return 'Cyber Storm';
  return 'Void Collapse';
}

function handleStageTransition() {
  const next = stageForDanger(dangerLevel());
  if (next === stage) {
    return;
  }
  stage = next;
  screenShake = Math.max(screenShake, 0.55);
  flashAlpha = Math.max(flashAlpha, 0.33);
  for (let i = 0; i < 18; i += 1) {
    spawnGrazeParticles(rand(60, canvas.width - 60), rand(60, canvas.height - 60), 120 + stage * 40);
  }
}

function updateGimmick(dt) {
  if (gimmick) {
    gimmick.timeLeft -= dt;
    if (gimmick.type === 'rain') {
      rainAccumulator += dt;
      while (rainAccumulator > 0.085) {
        rainAccumulator -= 0.085;
        spawnRainDrop(dangerLevel());
      }
    }
    if (gimmick.timeLeft <= 0) {
      gimmick = null;
      rainAccumulator = 0;
      screenShake = Math.max(screenShake, 0.2);
      flashAlpha = Math.max(flashAlpha, 0.15);
    }
    return;
  }

  gimmickCooldown -= dt;
  if (elapsed < 8 || gimmickCooldown > 0) {
    return;
  }

  const roll = Math.random();
  if (roll < 0.34) {
    gimmick = { type: 'rain', timeLeft: 5.8 };
  } else if (roll < 0.67) {
    gimmick = { type: 'slowfield', timeLeft: 5.2 };
  } else {
    gimmick = { type: 'storm', timeLeft: 4.6 };
  }
  gimmickCooldown = rand(12, 18);
  screenShake = Math.max(screenShake, 0.35);
  flashAlpha = Math.max(flashAlpha, 0.22);
}

function spawnRainDrop(danger) {
  const x = rand(0, canvas.width);
  const speed = scaledSpeed(danger, 1.4);
  createBullet(
    x,
    -10,
    rand(-35, 35),
    speed,
    rand(2.5, 5.6),
    hueForDanger(danger + 1.5),
    Math.random() < 0.3 ? 'missile' : Math.random() < 0.5 ? 'car' : 'orb'
  );
}

function gimmickLabelFor(type) {
  if (type === 'rain') return 'Meteor Rain';
  if (type === 'slowfield') return 'Slow Field';
  return 'Prism Storm';
}

function normalizeHue(value) {
  let h = value % 360;
  if (h < 0) {
    h += 360;
  }
  return h;
}
