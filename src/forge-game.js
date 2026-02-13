import { getHighScore, SCORE_KEYS, setHighScoreMax } from './highscore.js';

const STORAGE_KEY = 'forge_state_v1';

const TIERS = {
  common: { label: '일반', costMul: 1, sellMul: 1, breakRisk: 0.02 },
  rare: { label: '희귀', costMul: 1.25, sellMul: 1.3, breakRisk: 0.03 },
  epic: { label: '영웅', costMul: 1.55, sellMul: 1.75, breakRisk: 0.045 },
  legend: { label: '전설', costMul: 1.95, sellMul: 2.45, breakRisk: 0.06 }
};

const TIER_ORDER = ['common', 'rare', 'epic', 'legend'];
const FORM_INDEX_BY_TIER = {
  common: 0,
  rare: 2,
  epic: 4,
  legend: 6
};

const TIER_FLOOR_BY_LEVEL = [
  { minLevel: 26, tier: 'legend' },
  { minLevel: 16, tier: 'epic' },
  { minLevel: 8, tier: 'rare' },
  { minLevel: 0, tier: 'common' }
];

const SWORD_FORMS = [
  { name: '녹슨 단검', unlockAt: 0, minTier: 'common', rewardGold: 0, rewardGems: 0 },
  { name: '견습 롱소드', unlockAt: 2, minTier: 'common', rewardGold: 40, rewardGems: 0 },
  { name: '청동 기사검', unlockAt: 4, minTier: 'rare', rewardGold: 70, rewardGems: 0 },
  { name: '은빛 룬소드', unlockAt: 7, minTier: 'rare', rewardGold: 120, rewardGems: 1 },
  { name: '벽천 참마검', unlockAt: 10, minTier: 'rare', rewardGold: 180, rewardGems: 1 },
  { name: '적월 집행검', unlockAt: 13, minTier: 'epic', rewardGold: 240, rewardGems: 1 },
  { name: '황혼 성검', unlockAt: 16, minTier: 'epic', rewardGold: 320, rewardGems: 2 },
  { name: '성운 파괴검', unlockAt: 20, minTier: 'epic', rewardGold: 440, rewardGems: 2 },
  { name: '용왕 멸절검', unlockAt: 24, minTier: 'legend', rewardGold: 580, rewardGems: 3 },
  { name: '천공 절단검', unlockAt: 28, minTier: 'legend', rewardGold: 760, rewardGems: 3 },
  { name: '종말의 성검', unlockAt: 33, minTier: 'legend', rewardGold: 980, rewardGems: 4 }
];

const COSMETICS = {
  common: [
    { name: '기본 검집', bonus: 0.02 },
    { name: '가죽 손잡이', bonus: 0.03 },
    { name: '청동 장식', bonus: 0.03 }
  ],
  rare: [
    { name: '푸른 룬 손잡이', bonus: 0.05 },
    { name: '은빛 검신', bonus: 0.06 },
    { name: '쌍룡 각인', bonus: 0.06 }
  ],
  epic: [
    { name: '황금 불꽃 코어', bonus: 0.09 },
    { name: '별빛 오라', bonus: 0.1 },
    { name: '심연 날개', bonus: 0.11 }
  ],
  mythic: [
    { name: '태초의 검혼', bonus: 0.14 },
    { name: '천공 파편', bonus: 0.15 }
  ]
};

const MISSION_TYPES = ['attempts', 'successes', 'sellGold', 'crates'];

const el = {
  gold: document.getElementById('gold'),
  gems: document.getElementById('gems'),
  bestLevel: document.getElementById('bestLevel'),
  heat: document.getElementById('heat'),
  swordName: document.getElementById('swordName'),
  swordTier: document.getElementById('swordTier'),
  nextEvolution: document.getElementById('nextEvolution'),
  successChance: document.getElementById('successChance'),
  greatChance: document.getElementById('greatChance'),
  breakChance: document.getElementById('breakChance'),
  forgeStatus: document.getElementById('forgeStatus'),
  enhanceBtn: document.getElementById('enhanceBtn'),
  sellBtn: document.getElementById('sellBtn'),
  autoBtn: document.getElementById('autoBtn'),
  statMastery: document.getElementById('statMastery'),
  statLuck: document.getElementById('statLuck'),
  statSafety: document.getElementById('statSafety'),
  statTrader: document.getElementById('statTrader'),
  statFocus: document.getElementById('statFocus'),
  crateStatus: document.getElementById('crateStatus'),
  openBasicCrateBtn: document.getElementById('openBasicCrateBtn'),
  openPremiumCrateBtn: document.getElementById('openPremiumCrateBtn'),
  cosmeticSelect: document.getElementById('cosmeticSelect'),
  missionText: document.getElementById('missionText'),
  missionProgress: document.getElementById('missionProgress'),
  claimMissionBtn: document.getElementById('claimMissionBtn'),
  codexSummary: document.getElementById('codexSummary'),
  codexList: document.getElementById('codexList'),
  saleHistory: document.getElementById('saleHistory'),
  shopButtons: Array.from(document.querySelectorAll('button[data-up]'))
};

let state = loadState();
let autoTimer = null;

wireEvents();
render();

function wireEvents() {
  el.enhanceBtn.addEventListener('click', () => {
    enhanceOnce();
  });

  el.sellBtn.addEventListener('click', () => {
    sellCurrentSword();
  });

  el.autoBtn.addEventListener('click', () => {
    toggleAutoEnhance();
  });

  el.openBasicCrateBtn.addEventListener('click', () => {
    openCrate('basic');
  });

  el.openPremiumCrateBtn.addEventListener('click', () => {
    openCrate('premium');
  });

  el.claimMissionBtn.addEventListener('click', () => {
    claimMissionReward();
  });

  for (const button of el.shopButtons) {
    button.addEventListener('click', () => {
      upgradeStat(button.dataset.up);
    });
  }

  el.cosmeticSelect.addEventListener('change', () => {
    state.equippedCosmetic = el.cosmeticSelect.value;
    state.forgeStatus = `${state.equippedCosmetic} 장착 완료`;
    persist();
    render();
  });
}

function enhanceOnce() {
  const { successChance, greatChance, breakChance, cost } = calcForgeParams();
  if (state.gold < cost) {
    state.forgeStatus = `골드 부족 (필요: ${cost})`;
    stopAutoEnhance();
    renderAndSave();
    return;
  }

  state.gold -= cost;
  state.metrics.attempts += 1;
  state.attemptsSinceBless += 1;
  if (state.blessTurns > 0) {
    state.blessTurns -= 1;
  }

  const tier = TIERS[state.currentSword.tier];
  const roll = Math.random();
  if (roll < successChance) {
    const tierBefore = state.currentSword.tier;
    const isGreat = Math.random() < greatChance;
    const gain = isGreat ? 2 : 1;
    state.currentSword.level += gain;
    state.heat = clamp(state.heat + 1, 0, 10);
    state.metrics.successes += 1;

    if (state.heat >= 6 && state.blessTurns === 0) {
      state.blessTurns = 3;
    }

    const upChance = clamp(0.08 + state.stats.luck * 0.012 + state.heat * 0.01, 0.08, 0.42);
    if (isGreat && Math.random() < upChance) {
      promoteTier();
      state.forgeStatus = `대성공! +${gain}, 등급 상승!`;
    } else {
      state.forgeStatus = isGreat ? `대성공! +${gain}` : `성공! +${gain}`;
    }

    syncTierByLevel();
    if (tierBefore !== state.currentSword.tier) {
      state.forgeStatus = `${state.forgeStatus} / 등급: ${tierLabel(tierBefore)} -> ${tierLabel(state.currentSword.tier)}`;
    }

    const evolutions = tryEvolveSwordForm();
    if (evolutions.length > 0) {
      const names = evolutions.map((it) => it.name).join(', ');
      const rewardGold = evolutions.reduce((sum, it) => sum + it.rewardGold, 0);
      const rewardGems = evolutions.reduce((sum, it) => sum + it.rewardGems, 0);
      state.forgeStatus = `${state.forgeStatus} / 진화: ${names}`;
      if (rewardGold > 0 || rewardGems > 0) {
        const rewardText = `도감 보상 +${rewardGold}G${rewardGems > 0 ? `, +${rewardGems}젬` : ''}`;
        state.forgeStatus = `${state.forgeStatus} / ${rewardText}`;
      }
    }

    if (state.currentSword.level > state.bestLevel) {
      state.bestLevel = state.currentSword.level;
      setHighScoreMax(SCORE_KEYS.forge, state.bestLevel);
    }
  } else {
    state.heat = 0;
    const failRoll = Math.random();
    if (failRoll < breakChance + tier.breakRisk) {
      const drop = state.currentSword.level >= 10 ? 3 : 2;
      state.currentSword.level = Math.max(0, state.currentSword.level - drop);
      const salvage = 22 + state.stats.safety * 10;
      state.gold += salvage;
      state.forgeStatus = `파손! -${drop}, 보상 +${salvage} 골드`;
    } else if (failRoll < 0.72) {
      state.currentSword.level = Math.max(0, state.currentSword.level - 1);
      state.forgeStatus = '실패! 강화 수치 -1';
    } else {
      state.forgeStatus = '실패! 수치 유지';
    }
  }

  maybeGrantBonusByLevel();
  syncMissionProgress();
  renderAndSave();
}

function sellCurrentSword() {
  const sword = state.currentSword;
  if (sword.level <= 0) {
    state.forgeStatus = '최소 +1 이상부터 판매 가능합니다.';
    renderAndSave();
    return;
  }

  const cosmeticBonus = equippedCosmeticBonus();
  const value = Math.floor(
    (35 + sword.level * 22 + sword.level * sword.level * 14) *
      TIERS[sword.tier].sellMul *
      (1 + state.stats.trader * 0.1 + cosmeticBonus * 0.55)
  );

  state.gold += value;
  state.metrics.sellGold += value;
  state.saleHistory.unshift(`${swordFormName(sword.formIndex)} +${sword.level} 판매: ${value}G`);
  state.saleHistory = state.saleHistory.slice(0, 8);

  state.currentSword = createNewSword();
  state.heat = 0;
  state.blessTurns = 0;
  state.forgeStatus = `판매 완료 +${value} 골드`;

  syncMissionProgress();
  renderAndSave();
}

function toggleAutoEnhance() {
  if (autoTimer) {
    stopAutoEnhance();
    render();
    return;
  }

  autoTimer = setInterval(() => {
    if (state.status === 'paused') {
      return;
    }
    enhanceOnce();
    if (state.gold < calcForgeParams().cost) {
      stopAutoEnhance();
      state.forgeStatus = '자동 강화 중지 (골드 부족)';
      renderAndSave();
    }
  }, 360);

  render();
}

function stopAutoEnhance() {
  if (!autoTimer) {
    return;
  }
  clearInterval(autoTimer);
  autoTimer = null;
}

function upgradeStat(statKey) {
  if (!Object.hasOwn(state.stats, statKey)) {
    return;
  }
  const cost = statUpgradeCost(statKey);
  if (state.gold < cost) {
    state.forgeStatus = `골드 부족 (필요: ${cost})`;
    renderAndSave();
    return;
  }

  state.gold -= cost;
  state.stats[statKey] += 1;
  state.forgeStatus = `${statToLabel(statKey)} 상승!`;
  renderAndSave();
}

function openCrate(type) {
  if (type === 'basic') {
    if (state.gold < 220) {
      state.crateStatus = '골드 부족';
      renderAndSave();
      return;
    }
    state.gold -= 220;
  } else {
    if (state.gems < 8) {
      state.crateStatus = '보석 부족';
      renderAndSave();
      return;
    }
    state.gems -= 8;
  }

  state.metrics.crates += 1;
  state.cratePity += 1;
  const rarity = rollCrateRarity(type);
  const reward = randomFrom(COSMETICS[rarity]);
  const alreadyHas = state.cosmetics.includes(reward.name);

  if (alreadyHas) {
    const duplicateGold = rarity === 'mythic' ? 380 : rarity === 'epic' ? 220 : rarity === 'rare' ? 120 : 60;
    const duplicateGems = rarity === 'mythic' ? 3 : rarity === 'epic' ? 1 : 0;
    state.gold += duplicateGold;
    state.gems += duplicateGems;
    state.crateStatus = `중복: ${reward.name} -> +${duplicateGold}G${duplicateGems ? `, +${duplicateGems}젬` : ''}`;
  } else {
    state.cosmetics.push(reward.name);
    state.cosmetics.sort();
    state.crateStatus = `${rarity.toUpperCase()} 획득: ${reward.name}`;
  }

  if (rarity === 'epic' || rarity === 'mythic') {
    state.cratePity = 0;
  }

  syncMissionProgress();
  renderAndSave();
}

function rollCrateRarity(type) {
  const luckBoost = clamp(state.stats.luck * 0.01, 0, 0.18);
  const pityEpic = state.cratePity >= 9;
  const pityMythic = state.cratePity >= 20;

  if (pityMythic) {
    return 'mythic';
  }
  if (pityEpic && Math.random() < 0.85) {
    return 'epic';
  }

  let common = type === 'premium' ? 0.42 : 0.7;
  let rare = type === 'premium' ? 0.34 : 0.22;
  let epic = type === 'premium' ? 0.19 : 0.07;
  let mythic = type === 'premium' ? 0.05 : 0.01;

  common -= luckBoost;
  rare += luckBoost * 0.55;
  epic += luckBoost * 0.35;
  mythic += luckBoost * 0.1;

  const roll = Math.random();
  if (roll < mythic) return 'mythic';
  if (roll < mythic + epic) return 'epic';
  if (roll < mythic + epic + rare) return 'rare';
  return 'common';
}

function claimMissionReward() {
  if (!isMissionComplete()) {
    state.forgeStatus = '미션 조건이 아직 부족합니다.';
    renderAndSave();
    return;
  }
  if (state.mission.claimed) {
    state.forgeStatus = '이미 보상을 받았습니다.';
    renderAndSave();
    return;
  }

  state.gold += state.mission.rewardGold;
  state.gems += state.mission.rewardGems;
  state.mission.claimed = true;
  state.forgeStatus = `미션 완료! +${state.mission.rewardGold}G, +${state.mission.rewardGems}젬`;
  state.mission = makeMission(state.metrics);
  renderAndSave();
}

function syncMissionProgress() {
  const m = state.mission;
  const current = metricForType(m.type, state.metrics) - m.start;
  m.progress = clamp(current, 0, m.target);
}

function maybeGrantBonusByLevel() {
  const level = state.currentSword.level;
  if (level > 0 && level % 10 === 0) {
    const bonusGems = 1 + Math.floor(level / 20);
    state.gems += bonusGems;
    state.forgeStatus = `${state.forgeStatus} / 보너스 젬 +${bonusGems}`;
  }
}

function calcForgeParams() {
  const sword = state.currentSword;
  const tier = TIERS[sword.tier];
  const cosmeticBonus = equippedCosmeticBonus();

  const cost = Math.floor(
    (40 + sword.level * 18 + sword.level * sword.level * 4) *
      tier.costMul *
      Math.max(0.54, 1 - state.stats.focus * 0.03)
  );

  const successChance = clamp(
    0.9 -
      sword.level * 0.045 -
      (tier.costMul - 1) * 0.08 +
      state.stats.mastery * 0.015 +
      state.stats.luck * 0.008 +
      state.heat * 0.012 +
      (state.blessTurns > 0 ? 0.08 : 0) +
      cosmeticBonus * 0.45,
    0.08,
    0.97
  );

  const greatChance = clamp(
    0.05 +
      state.stats.luck * 0.006 +
      state.heat * 0.012 +
      state.stats.mastery * 0.003 +
      (state.blessTurns > 0 ? 0.04 : 0) +
      cosmeticBonus * 0.18,
    0.03,
    0.36
  );

  const breakChance = clamp(
    0.03 +
      sword.level * 0.012 +
      tier.breakRisk -
      state.stats.safety * 0.02 -
      (state.blessTurns > 0 ? 0.02 : 0) -
      cosmeticBonus * 0.15,
    0.005,
    0.34
  );

  return { successChance, greatChance, breakChance, cost };
}

function promoteTier() {
  const index = TIER_ORDER.indexOf(state.currentSword.tier);
  if (index < 0 || index >= TIER_ORDER.length - 1) {
    return;
  }
  state.currentSword.tier = TIER_ORDER[index + 1];
  state.currentSword.formIndex = Math.max(
    state.currentSword.formIndex ?? 0,
    FORM_INDEX_BY_TIER[state.currentSword.tier]
  );
}

function statUpgradeCost(statKey) {
  const level = state.stats[statKey];
  const base =
    statKey === 'mastery'
      ? 120
      : statKey === 'luck'
        ? 140
        : statKey === 'safety'
          ? 130
          : statKey === 'trader'
            ? 150
            : 110;
  const growth =
    statKey === 'trader'
      ? 1.55
      : statKey === 'focus'
        ? 1.42
        : 1.48;
  return Math.floor(base * Math.pow(growth, level));
}

function createNewSword() {
  const roll = Math.random();
  const baseRareChance = clamp(0.06 + state.stats.mastery * 0.01 + state.stats.luck * 0.01, 0.06, 0.28);
  const baseEpicChance = clamp(0.015 + state.stats.mastery * 0.003 + state.stats.luck * 0.003, 0.015, 0.09);
  let tier = 'common';
  if (roll < baseEpicChance) tier = 'epic';
  else if (roll < baseEpicChance + baseRareChance) tier = 'rare';

  return {
    tier,
    level: 0,
    formIndex: FORM_INDEX_BY_TIER[tier]
  };
}

function equippedCosmeticBonus() {
  const name = state.equippedCosmetic;
  const all = [...COSMETICS.common, ...COSMETICS.rare, ...COSMETICS.epic, ...COSMETICS.mythic];
  const item = all.find((cos) => cos.name === name);
  return item ? item.bonus : 0;
}

function render() {
  const p = calcForgeParams();

  el.gold.textContent = String(state.gold);
  el.gems.textContent = String(state.gems);
  el.bestLevel.textContent = String(state.bestLevel);
  el.heat.textContent = String(state.heat);

  el.swordName.textContent = `${swordFormName(state.currentSword.formIndex)} +${state.currentSword.level}`;
  el.swordTier.textContent = TIERS[state.currentSword.tier].label;
  el.nextEvolution.textContent = nextEvolutionText();
  el.successChance.textContent = `${Math.round(p.successChance * 100)}%`;
  el.greatChance.textContent = `${Math.round(p.greatChance * 100)}%`;
  el.breakChance.textContent = `${Math.round(p.breakChance * 100)}%`;
  el.forgeStatus.textContent = `${state.forgeStatus} (비용: ${p.cost}G${state.blessTurns > 0 ? ` / 축복 ${state.blessTurns}턴` : ''})`;

  el.statMastery.textContent = String(state.stats.mastery);
  el.statLuck.textContent = String(state.stats.luck);
  el.statSafety.textContent = String(state.stats.safety);
  el.statTrader.textContent = String(state.stats.trader);
  el.statFocus.textContent = String(state.stats.focus);

  for (const button of el.shopButtons) {
    const key = button.dataset.up;
    button.textContent = `${statToLabel(key)} 업 (${statUpgradeCost(key)}G)`;
  }

  el.autoBtn.textContent = autoTimer ? '자동 강화 ON' : '자동 강화 OFF';
  el.crateStatus.textContent = `${state.crateStatus} (피티 ${state.cratePity}/10)`;

  renderCosmetics();
  renderMission();
  renderCodex();
  renderSaleHistory();
}

function renderCosmetics() {
  const current = state.equippedCosmetic;
  el.cosmeticSelect.innerHTML = '';

  for (const name of state.cosmetics) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === current) {
      option.selected = true;
    }
    el.cosmeticSelect.append(option);
  }
}

function renderMission() {
  const m = state.mission;
  const label = missionLabel(m.type);
  el.missionText.textContent = `${label} ${m.target}회`;
  el.missionProgress.textContent = `${m.progress} / ${m.target} (보상: ${m.rewardGold}G, ${m.rewardGems}젬)`;
  el.claimMissionBtn.disabled = !isMissionComplete() || m.claimed;
}

function renderSaleHistory() {
  el.saleHistory.innerHTML = '';
  if (state.saleHistory.length === 0) {
    const li = document.createElement('li');
    li.textContent = '아직 판매 기록이 없습니다.';
    el.saleHistory.append(li);
    return;
  }

  for (const row of state.saleHistory) {
    const li = document.createElement('li');
    li.textContent = row;
    el.saleHistory.append(li);
  }
}

function renderCodex() {
  el.codexList.innerHTML = '';
  const unlockedSet = new Set(state.codexUnlocked);
  el.codexSummary.textContent = `${unlockedSet.size} / ${SWORD_FORMS.length} 해금`;

  for (let i = 0; i < SWORD_FORMS.length; i += 1) {
    const form = SWORD_FORMS[i];
    const li = document.createElement('li');
    li.className = unlockedSet.has(i) ? 'codex-unlocked' : 'codex-locked';
    if (unlockedSet.has(i)) {
      li.textContent = `해금: ${form.name} (권장 등급: ${tierLabel(form.minTier)})`;
    } else {
      li.textContent = `미해금: ??? (필요 +${form.unlockAt}, 권장 ${tierLabel(form.minTier)})`;
    }
    el.codexList.append(li);
  }
}

function renderAndSave() {
  render();
  persist();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write failures
  }
}

function loadState() {
  const best = getHighScore(SCORE_KEYS.forge, 0);
  const fallback = {
    gold: 450,
    gems: 16,
    bestLevel: best,
    heat: 0,
    blessTurns: 0,
    attemptsSinceBless: 0,
    status: 'running',
    currentSword: { tier: 'common', level: 0 },
    stats: {
      mastery: 0,
      luck: 0,
      safety: 0,
      trader: 0,
      focus: 0
    },
    cosmetics: ['기본 검집'],
    equippedCosmetic: '기본 검집',
    codexUnlocked: [0],
    cratePity: 0,
    crateStatus: '미개봉',
    forgeStatus: '강화를 눌러 시작하세요.',
    saleHistory: [],
    mission: null,
    metrics: {
      attempts: 0,
      successes: 0,
      sellGold: 0,
      crates: 0
    }
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      fallback.mission = makeMission(fallback.metrics);
      return fallback;
    }
    const parsed = JSON.parse(raw);
    const next = {
      ...fallback,
      ...parsed,
      stats: { ...fallback.stats, ...(parsed.stats ?? {}) },
      metrics: { ...fallback.metrics, ...(parsed.metrics ?? {}) },
      currentSword: { ...fallback.currentSword, ...(parsed.currentSword ?? {}) },
      cosmetics: Array.isArray(parsed.cosmetics) && parsed.cosmetics.length > 0 ? parsed.cosmetics : fallback.cosmetics,
      codexUnlocked: Array.isArray(parsed.codexUnlocked) ? parsed.codexUnlocked : fallback.codexUnlocked,
      saleHistory: Array.isArray(parsed.saleHistory) ? parsed.saleHistory.slice(0, 8) : []
    };

    if (!Number.isInteger(next.currentSword.formIndex)) {
      next.currentSword.formIndex = FORM_INDEX_BY_TIER[next.currentSword.tier] ?? 0;
    }

    syncTierByLevel(next);
    next.currentSword.formIndex = clamp(next.currentSword.formIndex, 0, SWORD_FORMS.length - 1);
    registerCodex(next.currentSword.formIndex, next);

    next.bestLevel = Math.max(next.bestLevel, getHighScore(SCORE_KEYS.forge, 0));
    setHighScoreMax(SCORE_KEYS.forge, next.bestLevel);
    next.mission = isMissionShapeValid(parsed.mission) ? parsed.mission : makeMission(next.metrics);
    syncMissionProgressForLoaded(next);
    return next;
  } catch {
    fallback.mission = makeMission(fallback.metrics);
    return fallback;
  }
}

function syncMissionProgressForLoaded(loaded) {
  const m = loaded.mission;
  const cur = metricForType(m.type, loaded.metrics) - m.start;
  m.progress = clamp(cur, 0, m.target);
}

function makeMission(metrics) {
  const type = randomFrom(MISSION_TYPES);
  const target =
    type === 'attempts'
      ? 12
      : type === 'successes'
        ? 7
        : type === 'sellGold'
          ? 1400
          : 4;

  const rewardGold =
    type === 'attempts'
      ? 320
      : type === 'successes'
        ? 420
        : type === 'sellGold'
          ? 520
          : 380;
  const rewardGems = type === 'crates' ? 4 : type === 'sellGold' ? 3 : 2;

  return {
    type,
    target,
    progress: 0,
    rewardGold,
    rewardGems,
    start: metricForType(type, metrics),
    claimed: false
  };
}

function isMissionShapeValid(m) {
  return Boolean(
    m &&
      typeof m.type === 'string' &&
      typeof m.target === 'number' &&
      typeof m.progress === 'number' &&
      typeof m.rewardGold === 'number' &&
      typeof m.rewardGems === 'number' &&
      typeof m.start === 'number'
  );
}

function metricForType(type, metrics) {
  if (type === 'attempts') return metrics.attempts;
  if (type === 'successes') return metrics.successes;
  if (type === 'sellGold') return metrics.sellGold;
  return metrics.crates;
}

function isMissionComplete() {
  return state.mission.progress >= state.mission.target;
}

function tierLabel(tier) {
  return TIERS[tier]?.label ?? tier;
}

function swordFormName(formIndex) {
  const safe = clamp(formIndex ?? 0, 0, SWORD_FORMS.length - 1);
  return SWORD_FORMS[safe].name;
}

function tryEvolveSwordForm() {
  const evolved = [];
  while (state.currentSword.formIndex < SWORD_FORMS.length - 1) {
    const nextIndex = state.currentSword.formIndex + 1;
    const needed = SWORD_FORMS[nextIndex].unlockAt;
    if (state.currentSword.level < needed) {
      break;
    }
    state.currentSword.formIndex = nextIndex;
    const newUnlock = registerCodex(nextIndex);
    const rewardGold = newUnlock ? SWORD_FORMS[nextIndex].rewardGold : 0;
    const rewardGems = newUnlock ? SWORD_FORMS[nextIndex].rewardGems : 0;
    if (rewardGold > 0 || rewardGems > 0) {
      state.gold += rewardGold;
      state.gems += rewardGems;
    }
    evolved.push({ name: SWORD_FORMS[nextIndex].name, rewardGold, rewardGems });
  }
  return evolved;
}

function nextEvolutionText() {
  const current = state.currentSword.formIndex ?? 0;
  if (current >= SWORD_FORMS.length - 1) {
    return '최종 형태';
  }
  const next = SWORD_FORMS[current + 1];
  return `${next.name} (필요 +${next.unlockAt}, 권장 ${tierLabel(next.minTier)})`;
}

function registerCodex(index, targetState = state) {
  if (!Array.isArray(targetState.codexUnlocked)) {
    targetState.codexUnlocked = [];
  }
  if (!targetState.codexUnlocked.includes(index)) {
    targetState.codexUnlocked.push(index);
    targetState.codexUnlocked.sort((a, b) => a - b);
  }
}

function tierIndex(tier) {
  return TIER_ORDER.indexOf(tier);
}

function tierFloorForLevel(level) {
  for (const floor of TIER_FLOOR_BY_LEVEL) {
    if (level >= floor.minLevel) {
      return floor.tier;
    }
  }
  return 'common';
}

function syncTierByLevel(targetState = state) {
  const floorTier = tierFloorForLevel(targetState.currentSword.level);
  const currentIndex = tierIndex(targetState.currentSword.tier);
  const floorIndex = tierIndex(floorTier);
  if (currentIndex >= floorIndex) {
    return false;
  }
  targetState.currentSword.tier = TIER_ORDER[floorIndex];
  targetState.currentSword.formIndex = Math.max(
    targetState.currentSword.formIndex ?? 0,
    FORM_INDEX_BY_TIER[targetState.currentSword.tier]
  );
  return true;
}

function missionLabel(type) {
  if (type === 'attempts') return '강화 시도';
  if (type === 'successes') return '강화 성공';
  if (type === 'sellGold') return '판매 골드 누적';
  return '상자 개봉';
}

function statToLabel(statKey) {
  if (statKey === 'mastery') return '숙련';
  if (statKey === 'luck') return '행운';
  if (statKey === 'safety') return '안정';
  if (statKey === 'trader') return '거래';
  return '집중';
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
