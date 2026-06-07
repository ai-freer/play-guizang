export type PlayerProgress = {
  version: 2;
  highestUnlockedLevel: number;
  currentLevel: number;
  lastScore: number;
  clearedLevels: number[];
  gameCompletedAt: string | null;
  updatedAt: string;
};

// v1 旧格式（仅用于读取迁移）
type LegacyV1 = {
  version: 1;
  highestUnlockedLevel: number;
  currentLevel: number;
  lastScore: number;
  updatedAt: string;
};

const COOKIE_KEY = "xxcs_progress";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function defaultProgress(): PlayerProgress {
  return {
    version: 2,
    highestUnlockedLevel: 1,
    currentLevel: 1,
    lastScore: 0,
    clearedLevels: [],
    gameCompletedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function loadProgress(): PlayerProgress {
  const item = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_KEY}=`));
  if (!item) return defaultProgress();

  try {
    const value = decodeURIComponent(item.slice(COOKIE_KEY.length + 1));
    const parsed = JSON.parse(value) as PlayerProgress | LegacyV1;

    // v1 → v2 迁移：解锁了 highest 关，认为前 highest-1 关都已通关
    if (parsed.version === 1) {
      const legacy = parsed as LegacyV1;
      const cleared = Array.from(
        { length: Math.max(0, legacy.highestUnlockedLevel - 1) },
        (_, i) => i + 1,
      );
      return {
        version: 2,
        highestUnlockedLevel: legacy.highestUnlockedLevel,
        currentLevel: legacy.currentLevel,
        lastScore: legacy.lastScore,
        clearedLevels: cleared,
        gameCompletedAt: null,
        updatedAt: legacy.updatedAt,
      };
    }

    const v2 = parsed as PlayerProgress;
    if (v2.version !== 2 || v2.currentLevel < 1 || v2.highestUnlockedLevel < 1) {
      return defaultProgress();
    }
    // 防御：clearedLevels 缺失时补空数组
    return {
      ...v2,
      clearedLevels: Array.isArray(v2.clearedLevels) ? v2.clearedLevels : [],
      gameCompletedAt: v2.gameCompletedAt ?? null,
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress): void {
  const next: PlayerProgress = {
    ...progress,
    updatedAt: new Date().toISOString(),
  };
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(next))}; max-age=${MAX_AGE_SECONDS}; path=/; samesite=lax`;
}
