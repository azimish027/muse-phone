'use strict';

/** 共享常量：前后端 Level 阶梯（单一数据源） */

// 0 XP → 1, 100 XP → 2, 300 XP → 3, ...
const LEVEL_STEPS = [0, 100, 300, 700, 1400, 2500, 4200, 6500, 9500, 13500];
const LEVEL_TITLES = ['初识', '新芽', '行者', '进阶', '熟练', '通达', '精进', '大师', '宗师', '传奇'];

function computeLevel(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_STEPS.length; i++) if (xp >= LEVEL_STEPS[i]) level = i + 1;
  const base = LEVEL_STEPS[level - 1] ?? 0;
  const next = LEVEL_STEPS[level] ?? base + 1000;
  const span = Math.max(1, next - base);
  return {
    level,
    levelTitle: LEVEL_TITLES[level - 1] || '传奇',
    levelXp: xp - base,
    levelSpan: span,
    levelProgress: Math.min(1, Math.max(0, (xp - base) / span)),
    nextLevelXp: next,
  };
}

module.exports = { LEVEL_STEPS, LEVEL_TITLES, computeLevel };
