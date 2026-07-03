import { describe, expect, it } from 'vitest';
import { checkInInput, sessionInput } from './schemas';

const baseCheckin = {
  date: '2026-07-01',
  sleep_hours: 7.5,
  sleep_quality: 4,
  readiness: 3,
  soreness: 2,
  stress: 1,
};

const baseSession = {
  id: '01980a00-0000-7000-8000-000000000000',
  date: '2026-07-01',
  duration_min: 60,
  srpe: 5,
};

describe('checkInInput', () => {
  it('parses a legacy queued payload without the new keys (ADR-017)', () => {
    const parsed = checkInInput.safeParse(baseCheckin);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.alcohol).toBe(false);
      expect(parsed.data.caffeine).toBe(false);
      expect(parsed.data.bodyweight_kg).toBeUndefined();
    }
  });

  it('accepts bodyweight/nutrition_adherence/alcohol/caffeine when present', () => {
    const parsed = checkInInput.safeParse({
      ...baseCheckin,
      bodyweight_kg: 82.4,
      nutrition_adherence: 4,
      alcohol: true,
      caffeine: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects bodyweight out of range', () => {
    expect(checkInInput.safeParse({ ...baseCheckin, bodyweight_kg: 25 }).success).toBe(false);
    expect(checkInInput.safeParse({ ...baseCheckin, bodyweight_kg: 300 }).success).toBe(false);
  });
});

describe('sessionInput', () => {
  it('accepts a plain session with no outcome fields', () => {
    expect(sessionInput.safeParse({ ...baseSession, modality: 'rugby' }).success).toBe(true);
  });

  it('accepts a gym session with the full topset trio', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'gym',
      lift: 'squat',
      top_set_weight_kg: 140,
      top_set_reps: 8,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a partial topset trio', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'gym',
      lift: 'squat',
      top_set_weight_kg: 140,
      // top_set_reps missing
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects lift on a non-gym session', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'running',
      lift: 'squat',
      top_set_weight_kg: 140,
      top_set_reps: 8,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a running session with distance', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'running',
      duration_min: 45,
      distance_km: 8.5,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects distance on a non-running session', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'rugby',
      distance_km: 8.5,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an implausible pace (too fast)', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'running',
      duration_min: 10,
      distance_km: 10,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts is_match on rugby with a match_rating', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'rugby',
      is_match: true,
      match_rating: 4,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects is_match on a non-rugby session', () => {
    const parsed = sessionInput.safeParse({
      ...baseSession,
      modality: 'gym',
      is_match: true,
      match_rating: 4,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects is_match=true without a match_rating, and vice versa', () => {
    expect(
      sessionInput.safeParse({ ...baseSession, modality: 'rugby', is_match: true }).success,
    ).toBe(false);
    expect(
      sessionInput.safeParse({ ...baseSession, modality: 'rugby', match_rating: 4 }).success,
    ).toBe(false);
  });

  it('defaults is_match to false for a legacy queued payload', () => {
    const parsed = sessionInput.safeParse({ ...baseSession, modality: 'rugby' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.is_match).toBe(false);
  });
});
