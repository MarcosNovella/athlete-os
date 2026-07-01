import { describe, expect, it } from 'vitest';
import { addDaysIso, localDateInTz } from './dates';

describe('localDateInTz', () => {
  it('resolves the local date across the UTC boundary (ART = UTC-3)', () => {
    // 01:00Z on Jul 2 is still Jul 1 in Buenos Aires.
    const at = new Date('2026-07-02T01:00:00Z');
    expect(localDateInTz('America/Argentina/Buenos_Aires', at)).toBe('2026-07-01');
  });

  it('matches UTC when the timezone is UTC', () => {
    const at = new Date('2026-07-02T01:00:00Z');
    expect(localDateInTz('UTC', at)).toBe('2026-07-02');
  });
});

describe('addDaysIso', () => {
  it('subtracts across month boundaries', () => {
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap years', () => {
    expect(addDaysIso('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('adds forward across year boundaries', () => {
    expect(addDaysIso('2025-12-31', 1)).toBe('2026-01-01');
  });
});
