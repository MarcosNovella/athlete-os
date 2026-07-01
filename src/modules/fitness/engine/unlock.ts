/**
 * Progressive unlock (ADR-012): the cold-start weakness becomes a retention
 * mechanic. Metrics unlock as history accumulates; locked ones expose a
 * countdown ("N días más de registro").
 */

export type UnlockKey = 'acute_load' | 'monotony' | 'acwr_provisional' | 'acwr_full' | 'baselines';

export type UnlockState = {
  key: UnlockKey;
  unlocked: boolean;
  /** Days (or check-ins for baselines) still required; 0 when unlocked. */
  remaining: number;
};

export const UNLOCK_THRESHOLDS: Record<UnlockKey, number> = {
  acute_load: 7, // calendar days of history
  monotony: 7, // calendar days of history
  acwr_provisional: 14, // calendar days of history
  acwr_full: 28, // calendar days of history
  baselines: 7, // recorded check-ins (count, not calendar)
};

export function unlockStates(historyDays: number, checkinCount: number): UnlockState[] {
  const progress: Record<UnlockKey, number> = {
    acute_load: historyDays,
    monotony: historyDays,
    acwr_provisional: historyDays,
    acwr_full: historyDays,
    baselines: checkinCount,
  };
  return (Object.keys(UNLOCK_THRESHOLDS) as UnlockKey[]).map((key) => {
    const remaining = Math.max(0, UNLOCK_THRESHOLDS[key] - progress[key]);
    return { key, unlocked: remaining === 0, remaining };
  });
}

export function isUnlocked(states: ReadonlyArray<UnlockState>, key: UnlockKey): boolean {
  return states.some((s) => s.key === key && s.unlocked);
}
