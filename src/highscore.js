export const SCORE_KEYS = {
  snake: 'snake_best_score',
  pong: 'pong_best_total',
  bullet: 'bullet_best_time'
};

export function getHighScore(key, fallback = 0) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function setHighScoreMax(key, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const current = getHighScore(key, 0);
  const next = Math.max(current, numeric);

  try {
    window.localStorage.setItem(key, String(next));
  } catch {
    // Ignore storage errors in restricted environments.
  }
  return next;
}
