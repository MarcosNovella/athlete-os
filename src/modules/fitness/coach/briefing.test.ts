import { describe, expect, it } from 'vitest';
import { computePatternCandidates } from '@/modules/fitness/engine/patterns';
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
    patterns: computePatternCandidates(obs, today),
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

  it('falls back honestly when there are no outcomes yet', () => {
    const b = briefingFor(29);
    expect(b).toContain('## Resultados (outcomes)');
    expect(b).toContain('Sin registros de outcomes todavía.');
  });

  it('renders outcome lines with deltas, PR-lift labels, pace wording and nutrition rollup', () => {
    const { obs, today } = fixture(29);
    obs.push(
      { metric_key: 'bodyweight', value: 82.4, effective_date: dateAt('2026-06-01', 0) },
      { metric_key: 'bodyweight', value: 81.8, effective_date: dateAt('2026-06-01', 10) },
      { metric_key: 'e1rm_squat', value: 152.5, effective_date: dateAt('2026-06-01', 0) },
      { metric_key: 'running_pace', value: 5.25, effective_date: dateAt('2026-06-01', 0) },
      { metric_key: 'running_pace', value: 5.5, effective_date: dateAt('2026-06-01', 20) },
      { metric_key: 'match_rating', value: 4, effective_date: dateAt('2026-06-01', 5) },
    );
    for (let i = 22; i < 29; i++) {
      obs.push({
        metric_key: 'nutrition_adherence',
        value: 4,
        effective_date: dateAt('2026-06-01', i),
      });
      obs.push({ metric_key: 'alcohol', value: 0, effective_date: dateAt('2026-06-01', i) });
      obs.push({ metric_key: 'caffeine', value: 1, effective_date: dateAt('2026-06-01', i) });
    }
    const b = buildBriefing({
      displayName: 'Marcos',
      snapshot: computeSnapshot(obs, today),
      trends: computeTrends(obs, today),
      patterns: computePatternCandidates(obs, today),
      recentSessions: [],
    });
    expect(b).toContain('Peso corporal: 81.8 kg');
    expect(b).toContain('Δ −0.6 kg vs registro anterior');
    expect(b).toContain('e1RM sentadilla: 152.5 kg');
    expect(b).toContain('primer registro'); // e1rm has a single point
    expect(b).toContain('Ritmo (running): 5:30 min/km');
    expect(b).toContain('más lento que tu media');
    expect(b).toContain('Último partido: 4/5');
    expect(b).toMatch(/Nutrición últimos 7 días: adherencia prom 4\/5 \(\d+ check-ins\)/);
    expect(b).toContain('cafeína 7 días');
  });

  it('falls back honestly when no device is connected', () => {
    const b = briefingFor(29);
    expect(b).toContain('## Recuperación (dato de dispositivo)');
    expect(b).toContain('Sin datos de dispositivo todavía.');
  });

  it('renders recovery lines with device framing and a 28d mean', () => {
    const { obs, today } = fixture(29);
    for (let i = 20; i < 29; i++) {
      obs.push({
        metric_key: 'recovery_score',
        value: 70 + i,
        effective_date: dateAt('2026-06-01', i),
      });
      obs.push({
        metric_key: 'hrv_rmssd',
        value: 65,
        effective_date: dateAt('2026-06-01', i),
      });
    }
    const b = buildBriefing({
      displayName: 'Marcos',
      snapshot: computeSnapshot(obs, today),
      trends: computeTrends(obs, today),
      patterns: computePatternCandidates(obs, today),
      recentSessions: [],
    });
    expect(b).toContain('Recovery (Whoop): 98% (2026-06-29)');
    expect(b).toContain('(dato de dispositivo)');
    expect(b).toContain('VFC RMSSD (Whoop): 65 ms');
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
      patterns: computePatternCandidates(obs, today),
      recentSessions: [],
    });
    expect(b).toContain('Monotonía: >5');
    expect(b).toContain('valor exacto');
  });

  it('shows the patterns section as locked before the 56d unlock', () => {
    const b = briefingFor(29);
    expect(b).toContain('## Candidatos de patrón (exploratorios — computados por el motor)');
    expect(b).toContain('- Bloqueado (faltan');
  });

  it('shows the empty-pairs line once unlocked with no candidates', () => {
    const start = '2026-01-01';
    const days = 56;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      // Flat, noise-free series: nothing should ever surface as a candidate.
      obs.push({ metric_key: 'readiness', value: 3, effective_date: dateAt(start, i) });
      obs.push({ metric_key: 'sleep_duration', value: 7.5, effective_date: dateAt(start, i) });
    }
    const today = dateAt(start, days - 1);
    const b = buildBriefing({
      displayName: 'Marcos',
      snapshot: computeSnapshot(obs, today),
      trends: computeTrends(obs, today),
      patterns: computePatternCandidates(obs, today),
      recentSessions: [],
    });
    expect(b).toContain('Sin patrones claros todavía');
    expect(b).toMatch(/\d+ pares vigilados/);
  });

  it('renders a candidate line identical to formatCandidateEs, plus the standing caveat', () => {
    // Reuse the same planted low-sleep/readiness shape as patterns.test.ts's
    // planted-association fixture, over 84 days (well past the 56d unlock).
    const start = '2026-01-01';
    const days = 84;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateAt(start, i);
      const low = i % 2 === 0;
      const wobble = i % 4 === 0 ? 0.2 : -0.2;
      obs.push({
        metric_key: 'sleep_duration',
        value: (low ? 6.0 : 8.0) + wobble,
        effective_date: date,
      });
      obs.push({
        metric_key: 'readiness',
        value: (low ? 2.0 : 4.0) + wobble,
        effective_date: date,
      });
    }
    const today = dateAt(start, days - 1);
    const patterns = computePatternCandidates(obs, today);
    const surfaced = patterns.surfaced.find((c) => c.pair.id === 'sleep_duration_low_readiness');
    expect(surfaced).toBeDefined();

    const b = buildBriefing({
      displayName: 'Marcos',
      snapshot: computeSnapshot(obs, today),
      trends: computeTrends(obs, today),
      patterns,
      recentSessions: [],
    });
    expect(b).toContain(`- ${surfaced?.statement}`);
    expect(b).toContain('Asociación exploratoria, no implica causa');
  });

  it('instructs the LLM to cite exact effect+n and never treat a candidate as cause', () => {
    const b = briefingFor(29);
    expect(b).toMatch(/Candidatos de patrón son asociaciones exploratorias, no causas/);
    expect(b).toContain('citá su efecto y n exactos');
  });
});
