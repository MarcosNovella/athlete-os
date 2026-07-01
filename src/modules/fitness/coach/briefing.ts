import type { EngineSnapshot } from '@/modules/fitness/engine/snapshot';
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

export function buildBriefing({
  displayName,
  snapshot: s,
  trends: t,
  recentSessions,
}: BriefingInput): string {
  const lines: string[] = [];

  lines.push(
    `# Briefing de rendimiento — ${displayName} — ${s.today} (día ${s.historyDays} de registro)`,
    '',
    '## Estado actual (calculado determinísticamente por el motor)',
    `- Carga hoy: ${s.todayLoad} AU · Carga últimos 7 días: ${s.weekLoad} AU`,
  );

  if (s.acute7 !== null) lines.push(`- Carga aguda (EWMA 7d): ${s.acute7} AU`);
  if (s.chronic28 !== null) lines.push(`- Carga crónica (EWMA 28d): ${s.chronic28} AU`);
  if (s.acwr !== null) {
    lines.push(
      `- ACWR: ${s.acwr.value} — banda ${BAND_ES[s.acwr.band]}${s.acwr.provisional ? ' (PROVISIONAL: historia corta)' : ''}`,
    );
  } else {
    const u = s.unlocks.find((x) => x.key === 'acwr_provisional');
    lines.push(`- ACWR: bloqueado (faltan ${u?.remaining ?? '?'} días de registro)`);
  }
  if (s.monotony !== null) lines.push(`- Monotonía: ${s.monotony} · Strain: ${s.strain ?? '—'}`);

  lines.push(metricLine('Readiness', s.readiness, '/5'), metricLine('Sueño', s.sleep, ' h'));

  lines.push(
    s.flags.length === 0
      ? '- Alertas activas: ninguna'
      : `- Alertas activas: ${s.flags.map(flagEs).join(' · ')}`,
  );

  lines.push('', '## Últimas semanas (lunes a domingo)');
  lines.push('| semana | carga (AU) | sesiones | sueño prom (h) | readiness prom | monotonía |');
  lines.push('|---|---|---|---|---|---|');
  for (const w of t.weeks) {
    lines.push(
      `| ${w.weekStart} | ${w.totalLoad} | ${w.sessionCount} | ${w.avgSleep ?? '—'} | ${w.avgReadiness ?? '—'} | ${w.monotony ?? '—'} |`,
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
    state.z !== null
      ? ` (z=${state.z} vs tu baseline 28d)`
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
      return `monotonía alta (${flag.value})`;
  }
}
