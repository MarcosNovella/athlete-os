import {
  BASELINE_MIN_COUNT,
  type DatedValue,
  readinessDropFlag,
  trailingBaseline,
  zScore,
} from './baselines';
import {
  type AcwrBand,
  acwr,
  acwrBand,
  dailyLoadSeries,
  ewmaSeries,
  monotony,
  strain,
} from './load';
import { isUnlocked, type UnlockState, unlockStates } from './unlock';

/**
 * Engine snapshot (ADR-012/014): everything the "today" view and the AI need,
 * computed ON READ from the observations spine. Pure — clock and data in.
 */

export type ObservationLite = {
  metric_key: string;
  value: number;
  effective_date: string;
};

export type MetricState = {
  value: number;
  /** z vs the personal trailing baseline; null while the baseline is forming. */
  z: number | null;
  baselineFormed: boolean;
} | null;

export type EngineFlag =
  | { kind: 'acwr'; band: AcwrBand; value: number }
  | { kind: 'readiness_drop' }
  | { kind: 'monotony_high'; value: number };

export type EngineSnapshot = {
  today: string;
  historyDays: number;
  checkinCount: number;
  todayLoad: number;
  weekLoad: number;
  acute7: number | null;
  chronic28: number | null;
  acwr: { value: number; band: AcwrBand; provisional: boolean } | null;
  monotony: number | null;
  strain: number | null;
  readiness: MetricState;
  sleep: MetricState;
  flags: EngineFlag[];
  unlocks: UnlockState[];
};

export function computeSnapshot(
  obs: ReadonlyArray<ObservationLite>,
  today: string,
): EngineSnapshot {
  const firstDate = obs.reduce<string>(
    (min, o) => (o.effective_date < min ? o.effective_date : min),
    today,
  );
  const historyDays = diffDays(firstDate, today) + 1;

  // Dense daily-load series: rest days are REAL zeros (ADR-012).
  const sessionLoads = obs
    .filter((o) => o.metric_key === 'session_load')
    .map((o) => ({ effective_date: o.effective_date, value: o.value }));
  const daily = dailyLoadSeries(sessionLoads, firstDate, today);
  const todayLoad = daily.at(-1)?.value ?? 0;
  const week = daily.slice(-7).map((d) => d.value);
  const weekLoad = week.reduce((a, b) => a + b, 0);

  const readinessValues = metricSeries(obs, 'readiness');
  const sleepValues = metricSeries(obs, 'sleep_duration');
  const checkinCount = readinessValues.length;

  const unlocks = unlockStates(historyDays, checkinCount);

  const acuteVal = ewmaSeries(daily, 7).at(-1)?.value ?? 0;
  const chronicVal = ewmaSeries(daily, 28).at(-1)?.value ?? 0;

  const acute7 = isUnlocked(unlocks, 'acute_load') ? round1(acuteVal) : null;
  const chronic28 = isUnlocked(unlocks, 'acwr_provisional') ? round1(chronicVal) : null;

  let acwrState: EngineSnapshot['acwr'] = null;
  if (isUnlocked(unlocks, 'acwr_provisional')) {
    const ratio = acwr(acuteVal, chronicVal);
    if (ratio !== null) {
      acwrState = {
        value: round2(ratio),
        band: acwrBand(ratio),
        provisional: !isUnlocked(unlocks, 'acwr_full'),
      };
    }
  }

  const monotonyVal = isUnlocked(unlocks, 'monotony') ? monotony(week) : null;
  const strainVal = isUnlocked(unlocks, 'monotony') ? strain(week) : null;

  const baselinesOn = isUnlocked(unlocks, 'baselines');
  const readiness = metricState(readinessValues, today, baselinesOn);
  const sleep = metricState(sleepValues, today, baselinesOn);

  const flags: EngineFlag[] = [];
  if (acwrState !== null && (acwrState.band === 'caution' || acwrState.band === 'high')) {
    flags.push({ kind: 'acwr', band: acwrState.band, value: acwrState.value });
  }
  if (baselinesOn && readinessDropFlag(readinessValues)) {
    flags.push({ kind: 'readiness_drop' });
  }
  if (monotonyVal !== null && monotonyVal > 2) {
    flags.push({ kind: 'monotony_high', value: round2(monotonyVal) });
  }

  return {
    today,
    historyDays,
    checkinCount,
    todayLoad,
    weekLoad,
    acute7,
    chronic28,
    acwr: acwrState,
    monotony: monotonyVal === null ? null : round2(monotonyVal),
    strain: strainVal === null ? null : round1(strainVal),
    readiness,
    sleep,
    flags,
    unlocks,
  };
}

function metricSeries(obs: ReadonlyArray<ObservationLite>, key: string): DatedValue[] {
  return obs
    .filter((o) => o.metric_key === key)
    .map((o) => ({ date: o.effective_date, value: o.value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function metricState(
  values: ReadonlyArray<DatedValue>,
  today: string,
  baselinesUnlocked: boolean,
): MetricState {
  const todayValue = values.find((v) => v.date === today);
  if (todayValue === undefined) return null;
  if (!baselinesUnlocked) return { value: todayValue.value, z: null, baselineFormed: false };

  const base = trailingBaseline(values, today);
  const formed = base !== null && base.count >= BASELINE_MIN_COUNT;
  const z = base !== null && formed ? zScore(todayValue.value, base) : null;
  return { value: todayValue.value, z: z === null ? null : round2(z), baselineFormed: formed };
}

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
