import { describe, expect, it } from 'vitest';
import { computeSnapshot, type ObservationLite } from '@/modules/fitness/engine/snapshot';
import { computeTrends } from '@/modules/fitness/engine/trends';
import { buildBriefing } from './briefing';

function dateAt(startIso: string, offset: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function fixture(days: number): { obs: ObservationLite[]; today: string } {
  const start = '2026-06-01';
  const obs: ObservationLite[] = [];
  for (let i = 0; i < days; i++) {
    const date = dateAt(start, i);
    obs.push({ metric_key: 'readiness', value: 3 + (i % 3), effective_date: date });
    obs.push({ metric_key: 'sleep_duration', value: 7 + (i % 2), effective_date: date });
    if (i % 2 === 0) obs.push({ metric_key: 'session_load', value: 400, effective_date: date });
  }
  return { obs, today: dateAt(start, days - 1) };
}

function briefingFor(days: number): string {
  const { obs, today } = fixture(days);
  return buildBriefing({
    displayName: 'Marcos',
    snapshot: computeSnapshot(obs, today),
    trends: computeTrends(obs, today),
    recentSessions: [
      {
        date: today,
        modality: 'rugby',
        duration_min: 80,
        srpe: 7,
        load: 560,
        notes: null,
      },
    ],
  });
}

describe('buildBriefing', () => {
  it('carries the engine numbers and the subject header', () => {
    const b = briefingFor(29);
    expect(b).toContain('Marcos');
    expect(b).toContain('día 29 de registro');
    expect(b).toContain('ACWR:');
    expect(b).toContain('rugby 80');
    expect(b).toMatch(/\| 2026-06-\d{2} \| \d+ \|/); // weekly table rows
  });

  it('ships the D1/D2 safety contract for any LLM', () => {
    const b = briefingFor(29);
    expect(b).toContain('HIPÓTESIS');
    expect(b).toContain('No inventes ni recalcules valores');
    expect(b).toContain('nunca veredictos');
    expect(b).toContain('consultar a un profesional');
    expect(b).toContain('no se imputan');
  });

  it('degrades honestly on cold start (locked metrics show countdowns)', () => {
    const b = briefingFor(2);
    expect(b).toContain('ACWR: bloqueado (faltan');
    expect(b).toContain('baseline');
  });

  it('tells the interpreted story: bands, week delta, tier wording, yesterday ghost', () => {
    const b = briefingFor(29);
    expect(b).toMatch(/- Monotonía: .+ — banda /);
    expect(b).toContain('vs semana previa');
    expect(b).toContain('(ayer: ');
    expect(b).toContain('tu media'); // z tier wording on readiness/sleep lines
    expect(b).toMatch(/Strain: .+ semanas/); // personal rank framing
    expect(b).toContain('| Δ carga |'); // weekly table carries the delta column
    expect(b).toContain('(parcial)'); // running week marked softly
  });

  it('caps the monotony display but keeps the exact value for the LLM', () => {
    const start = '2026-06-01';
    const obs: ObservationLite[] = [];
    for (let i = 0; i < 28; i++) {
      const date = dateAt(start, i);
      obs.push({ metric_key: 'readiness', value: 3 + (i % 3), effective_date: date });
      obs.push({ metric_key: 'session_load', value: i === 25 ? 401 : 400, effective_date: date });
    }
    const today = dateAt(start, 27);
    const b = buildBriefing({
      displayName: 'Demo',
      snapshot: computeSnapshot(obs, today),
      trends: computeTrends(obs, today),
      recentSessions: [],
    });
    expect(b).toContain('Monotonía: >5');
    expect(b).toContain('valor exacto');
  });
});
