import { formatDeltaPct } from '@/modules/fitness/engine/load';
import type { EngineSnapshot, StrainState } from '@/modules/fitness/engine/snapshot';
import type { TrendsData } from '@/modules/fitness/engine/trends';

/**
 * Deterministic AI briefing (ADR-016): the stable interface between the
 * engine and ANY LLM (claude.ai paste, /coach skill, future API). All numbers
 * come pre-computed from the engine — the LLM never does math (D2 invariant).
 */

export type RecentSession = {
  date: string;
  modality: string;
  duration_min: number;
  srpe: number;
  load: number | null;
  notes: string | null;
};

export type BriefingInput = {
  displayName: string;
  snapshot: EngineSnapshot;
  trends: TrendsData;
  recentSessions: ReadonlyArray<RecentSession>;
};

const BAND_ES: Record<string, string> = {
  low: 'baja',
  optimal: 'óptima',
  caution: 'precaución',
  high: 'alta',
};

const MONOTONY_BAND_ES: Record<'ok' | 'caution' | 'high', string> = {
  ok: 'ok',
  caution: 'precaución',
  high: 'alta',
};

const TIER_ES: Record<string, string> = {
  way_below: 'MUY bajo tu media',
  below: 'bajo tu media',
  typical: 'en tu media',
  above: 'sobre tu media',
  way_above: 'MUY sobre tu media',
};

/** "la más alta de tus últimas 4 semanas (rango 1493–4890)" — personal framing only. */
function strainPhraseEs(s: StrainState): string {
  if (s.rank === null || s.of === null) return `${s.value} (aún sin semanas previas comparables)`;
  const position =
    s.rank === 1
      ? `la más alta de tus últimas ${s.of} semanas`
      : s.rank === s.of
        ? `la más baja de tus últimas ${s.of} semanas`
        : `puesto ${s.rank} de tus últimas ${s.of} semanas`;
  return `${s.value} — ${position} (rango ${s.rangeMin}–${s.rangeMax})`;
}

export function buildBriefing({
  displayName,
  snapshot: s,
  trends: t,
  recentSessions,
}: BriefingInput): string {
  const lines: string[] = [];

  const weekDelta =
    s.weekLoadDeltaPct !== null ? ` (${formatDeltaPct(s.weekLoadDeltaPct)} vs semana previa)` : '';
  lines.push(
    `# Briefing de rendimiento — ${displayName} — ${s.today} (día ${s.historyDays} de registro)`,
    '',
    '## Estado actual (calculado determinísticamente por el motor)',
    `- Carga hoy: ${s.todayLoad} AU · Carga últimos 7 días: ${s.weekLoad} AU${weekDelta}`,
  );

  if (s.acute7 !== null) lines.push(`- Carga aguda (EWMA 7d): ${s.acute7} AU`);
  if (s.chronic28 !== null) lines.push(`- Carga crónica (EWMA 28d): ${s.chronic28} AU`);
  if (s.acwr !== null) {
    const yesterday = s.acwr.yesterday !== null ? ` (ayer: ${s.acwr.yesterday})` : '';
    lines.push(
      `- ACWR: ${s.acwr.value} — banda ${BAND_ES[s.acwr.band]}${yesterday}${s.acwr.provisional ? ' (PROVISIONAL: historia corta)' : ''}`,
    );
  } else {
    const u = s.unlocks.find((x) => x.key === 'acwr_provisional');
    lines.push(`- ACWR: bloqueado (faltan ${u?.remaining ?? '?'} días de registro)`);
  }
  if (s.monotony !== null && s.strain !== null) {
    lines.push(
      `- Monotonía: ${s.monotony.display} — banda ${MONOTONY_BAND_ES[s.monotony.band]} (valor exacto: ${s.monotony.value}) · Strain: ${strainPhraseEs(s.strain)}`,
    );
  }

  lines.push(metricLine('Readiness', s.readiness, '/5'), metricLine('Sueño', s.sleep, ' h'));

  lines.push(
    s.flags.length === 0
      ? '- Alertas activas: ninguna'
      : `- Alertas activas: ${s.flags.map(flagEs).join(' · ')}`,
  );

  lines.push('', '## Últimas semanas (lunes a domingo)');
  lines.push(
    '| semana | carga (AU) | Δ carga | sesiones | sueño prom (h) | readiness prom | monotonía |',
  );
  lines.push('|---|---|---|---|---|---|---|');
  for (const w of t.weeks) {
    const delta = w.loadDeltaPct !== null ? formatDeltaPct(w.loadDeltaPct) : '—';
    lines.push(
      `| ${w.weekStart}${w.isPartial ? ' (parcial)' : ''} | ${w.totalLoad} | ${delta} | ${w.sessionCount} | ${w.avgSleep ?? '—'} | ${w.avgReadiness ?? '—'} | ${w.monotonyDisplay ?? '—'} |`,
    );
  }

  lines.push('', '## Sesiones de los últimos 7 días');
  if (recentSessions.length === 0) {
    lines.push('- (sin sesiones registradas)');
  } else {
    for (const x of recentSessions) {
      lines.push(
        `- ${x.date} · ${x.modality} ${x.duration_min}' · RPE ${x.srpe} · ${x.load ?? '—'} AU${x.notes ? ` · notas: ${x.notes}` : ''}`,
      );
    }
  }

  lines.push(
    '',
    '## Completitud de datos',
    `- Check-ins registrados: ${s.checkinCount} en ${s.historyDays} días de historia. Los huecos son datos FALTANTES: no se imputan.`,
    `- Media personal (28d): sueño ${t.sleepMean ?? 'aún sin baseline'} · readiness ${t.readinessMean ?? 'aún sin baseline'}.`,
    '',
    '## Instrucciones para el análisis (IA)',
    'Actuá como coach de rendimiento deportivo (rugby, gimnasio, running). Reglas:',
    '1. Razoná SOLO sobre los números de este briefing y citá la métrica exacta en la que te apoyás. No inventes ni recalcules valores.',
    '2. ACWR y monotonía son FLAGS heurísticos, nunca veredictos: usalos como señal, no como diagnóstico.',
    '3. Si proponés un patrón, marcalo explícitamente como HIPÓTESIS, con su evidencia citada y confianza (baja/media/alta).',
    '4. Nada de consejo médico: si algo parece clínico (dolor persistente, síntomas), señalalo y recomendá consultar a un profesional.',
    '5. El objetivo es performance-first DENTRO de límites seguros: nunca recomiendes saltos de carga hacia la banda de riesgo.',
    '6. Respondé en español, conciso y accionable.',
    '',
    'Pedidos: (a) lectura del estado actual; (b) qué modificar la próxima semana, concreto; (c) 1-2 HIPÓTESIS marcadas si los datos lo sugieren.',
  );

  return lines.join('\n');
}

function metricLine(label: string, state: EngineSnapshot['readiness'], unit: string): string {
  if (state === null) return `- ${label} hoy: sin check-in`;
  const z =
    state.z !== null && state.tier !== null
      ? ` (z=${state.z} vs tu baseline 28d — ${TIER_ES[state.tier]})`
      : state.baselineFormed
        ? ''
        : ' (baseline aún formándose)';
  return `- ${label} hoy: ${state.value}${unit}${z}`;
}

function flagEs(flag: EngineSnapshot['flags'][number]): string {
  switch (flag.kind) {
    case 'acwr':
      return `ACWR ${flag.value} en banda ${BAND_ES[flag.band]}`;
    case 'readiness_drop':
      return 'readiness bajo el baseline 2+ días seguidos';
    case 'monotony_high':
      return `monotonía alta (valor exacto: ${flag.value})`;
  }
}
