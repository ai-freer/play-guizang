export type PlayerProgress = {
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
    version: 1,
    highestUnlockedLevel: 1,
    currentLevel: 1,
    lastScore: 0,
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
    const parsed = JSON.parse(value) as PlayerProgress;
    if (parsed.version !== 1 || parsed.currentLevel < 1 || parsed.highestUnlockedLevel < 1) {
      return defaultProgress();
    }
    return parsed;
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
