// Relative import: this pure module is also consumed by scripts/ outside Next (ADR-016).
import { addDaysIso } from '../../../lib/dates';
import { BASELINE_MIN_COUNT, type DatedValue, trailingBaseline } from './baselines';
import { type DayValue, dailyLoadSeries, monotony } from './load';
import type { ObservationLite } from './snapshot';
import { alignLagged, cohensD, mean, spearmanRho } from './stats';
import { UNLOCK_THRESHOLDS } from './unlock';

/**
 * Pattern candidates (V2.3 ADR-025): binned comparison ("days below/above your
 * own baseline" or "toggle on/off") + Cohen's d for magnitude, with a Spearman
 * concordance check as a veto against bin artifacts. Computed ON READ
 * (ADR-014) from the same 90d window as the rest of the engine — NEVER
 * persisted; only /coach may promote a candidate into a written insight,
 * citing its exact effect + n, never as cause. Exploratory, not causal
 * inference: curated ~15-pair grid, top-K surfaced, always with a caveat.
 */

export const PATTERN_MIN_N_PER_BIN = 8;
export const PATTERN_MIN_ABS_D = 0.6;
export const PATTERN_TOP_K = 3;
/** Dead zone, NOT a magnitude gate — |d| already gates magnitude; rho only catches bin artifacts. */
const RHO_CONCORDANCE_MIN_ABS = 0.1;

export const PATTERN_CAVEAT =
  'Asociación exploratoria, no implica causa. De ~15 pares vigilados se muestran los de mayor efecto — con pocos datos, alguno puede ser ruido.';

type BinMode = 'below_mean' | 'above_mean' | 'binary';

export type PatternPair = {
  id: string;
  predictor: string;
  binMode: BinMode;
  outcomeKey: string;
  lagDays: number;
  predictorPhrase: string;
  outcomePhrase: string;
  outcomeUnit: string;
  lowerIsBetter?: boolean;
  minRawDiff: number;
  confounders: string;
};

export const PATTERN_PAIRS: readonly PatternPair[] = [
  // a — sleep
  {
    id: 'sleep_duration_low_readiness',
    predictor: 'sleep_duration',
    binMode: 'below_mean',
    outcomeKey: 'readiness',
    lagDays: 0,
    predictorPhrase: 'En los días que dormís menos que tu media',
    outcomePhrase: 'readiness',
    outcomeUnit: '/5',
    minRawDiff: 0.4,
    confounders: 'Puede reflejar estrés o rutina cargada, no solo horas de sueño.',
  },
  {
    id: 'sleep_device_low_readiness',
    predictor: 'sleep_device',
    binMode: 'below_mean',
    outcomeKey: 'readiness',
    lagDays: 0,
    predictorPhrase: 'En los días que tu dispositivo registra menos sueño que tu media',
    outcomePhrase: 'readiness',
    outcomeUnit: '/5',
    minRawDiff: 0.4,
    confounders:
      'El sueño de dispositivo puede diferir del auto-reportado; mismo posible confusor que el sueño manual.',
  },
  // b — binary toggles (previous night → lag 0)
  {
    id: 'alcohol_readiness',
    predictor: 'alcohol',
    binMode: 'binary',
    outcomeKey: 'readiness',
    lagDays: 0,
    predictorPhrase: 'Las mañanas después de tomar alcohol',
    outcomePhrase: 'readiness',
    outcomeUnit: '/5',
    minRawDiff: 0.4,
    confounders:
      'El alcohol suele acompañar salidas sociales o semanas más livianas de entrenamiento — no aislado.',
  },
  {
    id: 'alcohol_sleep_duration',
    predictor: 'alcohol',
    binMode: 'binary',
    outcomeKey: 'sleep_duration',
    lagDays: 0,
    predictorPhrase: 'Las noches que tomás alcohol',
    outcomePhrase: 'horas de sueño',
    outcomeUnit: 'h',
    minRawDiff: 0.4,
    confounders:
      'El alcohol suele acompañar salidas sociales o semanas más livianas de entrenamiento — no aislado.',
  },
  {
    id: 'caffeine_sleep_duration',
    predictor: 'caffeine',
    binMode: 'binary',
    outcomeKey: 'sleep_duration',
    lagDays: 0,
    predictorPhrase: 'Las noches que tomás cafeína',
    outcomePhrase: 'horas de sueño',
    outcomeUnit: 'h',
    minRawDiff: 0.4,
    confounders: 'El consumo de cafeína varía con la rutina diaria — asociación exploratoria.',
  },
  {
    id: 'caffeine_readiness',
    predictor: 'caffeine',
    binMode: 'binary',
    outcomeKey: 'readiness',
    lagDays: 0,
    predictorPhrase: 'Las mañanas después de tomar cafeína la noche anterior',
    outcomePhrase: 'readiness',
    outcomeUnit: '/5',
    minRawDiff: 0.4,
    confounders: 'El consumo de cafeína varía con la rutina diaria — asociación exploratoria.',
  },
  // c — training load
  {
    id: 'prev7_load_high_readiness',
    predictor: 'prev7_load',
    binMode: 'above_mean',
    outcomeKey: 'readiness',
    lagDays: 0,
    predictorPhrase: 'En los días después de una semana de carga alta (7d) respecto de tu media',
    outcomePhrase: 'readiness',
    outcomeUnit: '/5',
    minRawDiff: 0.4,
    confounders: 'La carga de la semana se mezcla con el calendario de competencia o trabajo.',
  },
  {
    id: 'prev7_monotony_high_readiness',
    predictor: 'prev7_monotony',
    binMode: 'above_mean',
    outcomeKey: 'readiness',
    lagDays: 0,
    predictorPhrase: 'En los días después de una semana muy monótona respecto de tu media',
    outcomePhrase: 'readiness',
    outcomeUnit: '/5',
    minRawDiff: 0.4,
    confounders: 'La monotonía de la semana se mezcla con el calendario de competencia o trabajo.',
  },
  {
    id: 'prev7_load_high_hrv_rmssd',
    predictor: 'prev7_load',
    binMode: 'above_mean',
    outcomeKey: 'hrv_rmssd',
    lagDays: 0,
    predictorPhrase: 'En los días después de una semana de carga alta (7d) respecto de tu media',
    outcomePhrase: 'VFC (RMSSD)',
    outcomeUnit: 'ms',
    minRawDiff: 3,
    confounders: 'La carga de la semana se mezcla con el calendario de competencia o trabajo.',
  },
  {
    id: 'prev7_load_high_hrv_sdnn',
    predictor: 'prev7_load',
    binMode: 'above_mean',
    outcomeKey: 'hrv_sdnn',
    lagDays: 0,
    predictorPhrase: 'En los días después de una semana de carga alta (7d) respecto de tu media',
    outcomePhrase: 'VFC (SDNN)',
    outcomeUnit: 'ms',
    minRawDiff: 3,
    confounders: 'La carga de la semana se mezcla con el calendario de competencia o trabajo.',
  },
  // d — recovery → performance
  {
    id: 'recovery_low_match_rating',
    predictor: 'recovery_score',
    binMode: 'below_mean',
    outcomeKey: 'match_rating',
    lagDays: 0,
    predictorPhrase: 'En los días que tu recovery score está bajo tu media',
    outcomePhrase: 'puntaje de partido',
    outcomeUnit: '',
    minRawDiff: 0.4,
    confounders:
      'El recovery score integra sueño y VFC — no aísla una causa única. Tu progreso de largo plazo puede mezclarse con este efecto de corto plazo.',
  },
  {
    id: 'recovery_low_running_pace',
    predictor: 'recovery_score',
    binMode: 'below_mean',
    outcomeKey: 'running_pace',
    lagDays: 0,
    predictorPhrase: 'En los días que tu recovery score está bajo tu media',
    outcomePhrase: 'ritmo de carrera',
    outcomeUnit: 'min/km',
    lowerIsBetter: true,
    minRawDiff: 0.15,
    confounders:
      'El recovery score integra sueño y VFC — no aísla una causa única. Tu progreso de largo plazo puede mezclarse con este efecto de corto plazo.',
  },
  {
    id: 'resting_hr_high_running_pace',
    predictor: 'resting_hr',
    binMode: 'above_mean',
    outcomeKey: 'running_pace',
    lagDays: 0,
    predictorPhrase: 'En los días que tu FC en reposo está sobre tu media',
    outcomePhrase: 'ritmo de carrera',
    outcomeUnit: 'min/km',
    lowerIsBetter: true,
    minRawDiff: 0.15,
    confounders:
      'Tu progreso de largo plazo (te volvés más rápido con el tiempo) puede mezclarse con este efecto de corto plazo.',
  },
  {
    id: 'hrv_rmssd_low_match_rating',
    predictor: 'hrv_rmssd',
    binMode: 'below_mean',
    outcomeKey: 'match_rating',
    lagDays: 0,
    predictorPhrase: 'En los días que tu VFC (RMSSD) está bajo tu media',
    outcomePhrase: 'puntaje de partido',
    outcomeUnit: '',
    minRawDiff: 0.4,
    confounders: 'Tu progreso de largo plazo puede mezclarse con este efecto de corto plazo.',
  },
  {
    id: 'recovery_low_e1rm_squat',
    predictor: 'recovery_score',
    binMode: 'below_mean',
    outcomeKey: 'e1rm_squat',
    lagDays: 0,
    predictorPhrase: 'En los días que tu recovery score está bajo tu media',
    outcomePhrase: 'e1RM de sentadilla',
    outcomeUnit: 'kg',
    minRawDiff: 2,
    confounders:
      'El recovery score integra sueño y VFC — no aísla una causa única. Tu progreso de fuerza de largo plazo puede mezclarse con este efecto de corto plazo.',
  },
];

export type PatternStatus = 'candidate' | 'insufficient_data' | 'no_signal';

export type PatternResult = {
  pairId: string;
  status: PatternStatus;
  nExposed: number;
  nReference: number;
  exposedMean: number | null;
  referenceMean: number | null;
  /** exposedMean - referenceMean, raw outcome units, round2. */
  diff: number | null;
  cohensD: number | null;
  /** Internal concordance check — never rendered (tests/debug only). */
  rho: number | null;
};

export type PatternCandidate = {
  pair: PatternPair;
  result: PatternResult;
  statement: string;
};

export type PatternsData = {
  historyDays: number;
  locked: boolean;
  remainingDays: number;
  evaluatedCount: number;
  results: PatternResult[];
  surfaced: PatternCandidate[];
};

/** prev7_load[d] = sum of dense daily loads d-7..d-1. */
function prev7LoadSeries(dailySeries: ReadonlyArray<DayValue>): DatedValue[] {
  const out: DatedValue[] = [];
  for (let i = 7; i < dailySeries.length; i++) {
    const day = dailySeries[i];
    if (day === undefined) continue;
    const window = dailySeries.slice(i - 7, i).map((d) => d.value);
    out.push({ date: day.date, value: window.reduce((a, b) => a + b, 0) });
  }
  return out;
}

/** prev7_monotony[d] = Foster monotony() over d-7..d-1; null (day dropped) when SD→0. */
function prev7MonotonySeries(dailySeries: ReadonlyArray<DayValue>): DatedValue[] {
  const out: DatedValue[] = [];
  for (let i = 7; i < dailySeries.length; i++) {
    const day = dailySeries[i];
    if (day === undefined) continue;
    const window = dailySeries.slice(i - 7, i).map((d) => d.value);
    const m = monotony(window);
    if (m !== null) out.push({ date: day.date, value: m });
  }
  return out;
}

function metricSeries(obs: ReadonlyArray<ObservationLite>, key: string): DatedValue[] {
  return obs
    .filter((o) => o.metric_key === key)
    .map((o) => ({ date: o.effective_date, value: o.value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function classifyBins(
  pair: PatternPair,
  aligned: ReadonlyArray<{ date: string; predictor: number; outcome: number }>,
  predictorSeries: ReadonlyArray<DatedValue>,
): {
  exposedOutcomes: number[];
  referenceOutcomes: number[];
  concordancePredictor: number[];
  concordanceOutcome: number[];
} {
  const exposedOutcomes: number[] = [];
  const referenceOutcomes: number[] = [];
  const concordancePredictor: number[] = [];
  const concordanceOutcome: number[] = [];

  for (const p of aligned) {
    if (pair.binMode === 'binary') {
      concordancePredictor.push(p.predictor);
      concordanceOutcome.push(p.outcome);
      if (p.predictor === 1) exposedOutcomes.push(p.outcome);
      else if (p.predictor === 0) referenceOutcomes.push(p.outcome);
      continue;
    }
    // Continuous predictor: bin vs its OWN trailing 28d baseline (excludes
    // same-day, ADR-012). Days where the baseline hasn't formed drop.
    const base = trailingBaseline(predictorSeries, p.date, 28);
    if (base === null || base.count < BASELINE_MIN_COUNT) continue;
    concordancePredictor.push(p.predictor);
    concordanceOutcome.push(p.outcome);
    const isExposed =
      pair.binMode === 'below_mean' ? p.predictor < base.mean : p.predictor > base.mean;
    if (isExposed) exposedOutcomes.push(p.outcome);
    else referenceOutcomes.push(p.outcome);
  }
  return { exposedOutcomes, referenceOutcomes, concordancePredictor, concordanceOutcome };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function evaluatePair(pair: PatternPair, seriesFor: (key: string) => DatedValue[]): PatternResult {
  const predictorSeries = seriesFor(pair.predictor);
  const outcomeSeries = seriesFor(pair.outcomeKey);
  const aligned = alignLagged(predictorSeries, outcomeSeries, pair.lagDays);
  const { exposedOutcomes, referenceOutcomes, concordancePredictor, concordanceOutcome } =
    classifyBins(pair, aligned, predictorSeries);

  const nExposed = exposedOutcomes.length;
  const nReference = referenceOutcomes.length;

  if (nExposed < PATTERN_MIN_N_PER_BIN || nReference < PATTERN_MIN_N_PER_BIN) {
    return {
      pairId: pair.id,
      status: 'insufficient_data',
      nExposed,
      nReference,
      exposedMean: null,
      referenceMean: null,
      diff: null,
      cohensD: null,
      rho: null,
    };
  }

  const exposedMean = round2(mean(exposedOutcomes) as number);
  const referenceMean = round2(mean(referenceOutcomes) as number);
  const diff = round2(exposedMean - referenceMean);
  const dRaw = cohensD(exposedOutcomes, referenceOutcomes);
  const cohensDVal = dRaw === null ? null : round2(dRaw);
  const rhoRaw = spearmanRho(concordancePredictor, concordanceOutcome);
  const rho = rhoRaw === null ? null : round2(rhoRaw);

  // below_mean bins put the LOW-predictor days in "exposed", so a positive
  // predictor/outcome relationship (rho>0) shows up as a NEGATIVE diff there
  // (opposite sign). above_mean/binary bins put the HIGH-predictor days in
  // "exposed", so diff and rho share the same sign. Normalize before comparing.
  const directionSign = pair.binMode === 'below_mean' ? -1 : 1;
  const passesD = cohensDVal !== null && Math.abs(cohensDVal) >= PATTERN_MIN_ABS_D;
  const passesRaw = Math.abs(diff) >= pair.minRawDiff;
  const passesConcordance =
    rho !== null &&
    Math.abs(rho) >= RHO_CONCORDANCE_MIN_ABS &&
    diff !== 0 &&
    Math.sign(diff) === directionSign * Math.sign(rho);

  const status: PatternStatus =
    passesD && passesRaw && passesConcordance ? 'candidate' : 'no_signal';

  return {
    pairId: pair.id,
    status,
    nExposed,
    nReference,
    exposedMean,
    referenceMean,
    diff,
    cohensD: cohensDVal,
    rho,
  };
}

/**
 * ONE statement builder shared by the /patrones UI and the coach briefing
 * (same-story invariant, ADR-016 spirit). Assumes `result.status === 'candidate'`
 * (exposedMean/referenceMean/diff are non-null there).
 */
export function formatCandidateEs(pair: PatternPair, result: PatternResult): string {
  if (result.exposedMean === null || result.referenceMean === null || result.diff === null)
    return '';
  let directionNote = '';
  if (pair.lowerIsBetter) {
    directionNote = result.diff > 0 ? ' (más lento)' : result.diff < 0 ? ' (más rápido)' : '';
  }
  const unit = pair.outcomeUnit ? pair.outcomeUnit : '';
  return `${pair.predictorPhrase}, tu ${pair.outcomePhrase} promedia ${result.exposedMean}${unit} vs ${result.referenceMean}${unit} en los demás días${directionNote} (n=${result.nExposed} vs ${result.nReference}).`;
}

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function computePatternCandidates(
  obs: ReadonlyArray<ObservationLite>,
  today: string,
): PatternsData {
  const firstDate = obs.reduce<string>(
    (min, o) => (o.effective_date < min ? o.effective_date : min),
    today,
  );
  const historyDays = diffDays(firstDate, today) + 1;
  const remainingDays = Math.max(0, UNLOCK_THRESHOLDS.patterns - historyDays);
  const locked = remainingDays > 0;

  if (locked) {
    return {
      historyDays,
      locked: true,
      remainingDays,
      evaluatedCount: 0,
      results: [],
      surfaced: [],
    };
  }

  const sessionLoads = obs
    .filter((o) => o.metric_key === 'session_load')
    .map((o) => ({ effective_date: o.effective_date, value: o.value }));
  const dailyFrom = addDaysIso(firstDate, -7);
  const dailySeries = dailyLoadSeries(sessionLoads, dailyFrom, today);
  const prev7Load = prev7LoadSeries(dailySeries);
  const prev7Monotony = prev7MonotonySeries(dailySeries);

  const seriesFor = (key: string): DatedValue[] => {
    if (key === 'prev7_load') return prev7Load;
    if (key === 'prev7_monotony') return prev7Monotony;
    return metricSeries(obs, key);
  };

  const results: PatternResult[] = [];
  const candidates: PatternCandidate[] = [];
  for (const pair of PATTERN_PAIRS) {
    const result = evaluatePair(pair, seriesFor);
    results.push(result);
    if (result.status === 'candidate') {
      candidates.push({ pair, result, statement: formatCandidateEs(pair, result) });
    }
  }

  const surfaced = [...candidates]
    .sort((a, b) => Math.abs(b.result.cohensD ?? 0) - Math.abs(a.result.cohensD ?? 0))
    .slice(0, PATTERN_TOP_K);

  return {
    historyDays,
    locked: false,
    remainingDays: 0,
    evaluatedCount: PATTERN_PAIRS.length,
    results,
    surfaced,
  };
}
