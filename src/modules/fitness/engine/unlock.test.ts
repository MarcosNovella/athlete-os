import { describe, expect, it } from 'vitest';
import { isUnlocked, unlockStates } from './unlock';

describe('unlockStates', () => {
  it('locks everything on day 1 with the right countdowns', () => {
    const states = unlockStates(1, 1);
    expect(isUnlocked(states, 'acute_load')).toBe(false);
    expect(states.find((s) => s.key === 'acute_load')?.remaining).toBe(6);
    expect(states.find((s) => s.key === 'acwr_full')?.remaining).toBe(27);
    expect(states.find((s) => s.key === 'baselines')?.remaining).toBe(6);
  });

  it('unlocks week-2 metrics at 7 days of history', () => {
    const states = unlockStates(7, 5);
    expect(isUnlocked(states, 'acute_load')).toBe(true);
    expect(isUnlocked(states, 'monotony')).toBe(true);
    expect(isUnlocked(states, 'acwr_provisional')).toBe(false);
  });

  it('unlocks provisional ACWR at 14 days and full at 28', () => {
    expect(isUnlocked(unlockStates(14, 10), 'acwr_provisional')).toBe(true);
    expect(isUnlocked(unlockStates(14, 10), 'acwr_full')).toBe(false);
    expect(isUnlocked(unlockStates(28, 20), 'acwr_full')).toBe(true);
  });

  it('gates baselines by check-in COUNT, not calendar days', () => {
    expect(isUnlocked(unlockStates(30, 3), 'baselines')).toBe(false);
    expect(isUnlocked(unlockStates(10, 7), 'baselines')).toBe(true);
  });

  it('gates patterns (V2.3) at 56 calendar days, locked at 55 with remaining 1', () => {
    const locked = unlockStates(55, 40);
    expect(isUnlocked(locked, 'patterns')).toBe(false);
    expect(locked.find((s) => s.key === 'patterns')?.remaining).toBe(1);

    const unlocked = unlockStates(56, 40);
    expect(isUnlocked(unlocked, 'patterns')).toBe(true);
    expect(unlocked.find((s) => s.key === 'patterns')?.remaining).toBe(0);
  });
});
