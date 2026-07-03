import {
  BASELINE_MIN_COUNT,
  type DatedValue,
  readinessDropFlag,
  trailingBaseline,
  type ZTier,
  zScore,
  zTier,
} from './baselines';
import {
  type AcwrBand,
  acwr,
  acwrBand,
  dailyLoadSeries,
  ewmaSeries,
  type MonotonyBand,
  monotony,
  monotonyBand,
  monotonyDisplay,
  strain,
} from './load';
import { isUnlocked, UNLOCK_THRESHOLDS, type UnlockState, unlockStates } from './unlock';

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
  /** Magnitude tier of the (rounded) z, for display consistency; null iff z is null. */
  tier: ZTier | null;
  baselineFormed: boolean;
} | null;

export type MonotonyState = {
  /** RAW (round2, UNCAPPED) — flags, tests and the LLM keep the true number. */
  value: number;
  band: MonotonyBand;
  /** The only thing human UIs print: '1.42' … '>5' (SD→0 explosion capped). */
  display: string;
};

export type StrainState = {
  /** Current rolling 7-day window (round1). AU-scaled: personal, no universal band. */
  value: number;
  /**
   * Rank among comparable rolling 7d windows ending today, -7d, -14d, -21d
   * (1 = highest strain). Windows outside history or with null strain are
   * skipped; rank/of/rangeMin/rangeMax are all null when no prior window compares.
   */
  rank: number | null;
  of: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
};

export type EngineFlag =
  | { kind: 'acwr'; band: AcwrBand; value: number }
  | { kind: 'readiness_drop' }
  | { kind: 'monotony_high'; value: number };

export type SignalSeverity = 'ok' | 'caution' | 'high';

/** Only the red ACWR band maps to 'high' — red stays reserved (ADR-012 spirit). */
export function flagSeverity(flag: EngineFlag): Exclude<SignalSeverity, 'ok'> {
  return flag.kind === 'acwr' && flag.band === 'high' ? 'high' : 'caution';
}

export type SignalSummary = { count: number; worst: SignalSeverity };

/** Header cue aggregation ("N señales activas") — señales, never a verdict. */
export function signalSummary(flags: ReadonlyArray<EngineFlag>): SignalSummary {
  let worst: SignalSeverity = 'ok';
  for (const flag of flags) {
    const s = flagSeverity(flag);
    if (s === 'high') worst = 'high';
    else if (worst === 'ok') worst = 'caution';
  }
  return { count: flags.length, worst };
}

export type EngineSnapshot = {
  today: string;
  historyDays: number;
  checkinCount: number;
  todayLoad: number;
  weekLoad: number;
  /** Rolling days -14..-8; null while history is shorter than 14 days. */
  prevWeekLoad: number | null;
  /** weekLoad vs prevWeekLoad, whole percent; null when prev is null or 0. */
  weekLoadDeltaPct: number | null;
  acute7: number | null;
  chronic28: number | null;
  acwr: {
    value: number;
    band: AcwrBand;
    provisional: boolean;
    /** Yesterday's ratio (ghost marker); null unless ACWR was already unlocked yesterday. */
    yesterday: number | null;
  } | null;
  monotony: MonotonyState | null;
  strain: StrainState | null;
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

  const prevWeekLoad =
    historyDays >= 14
      ? daily
          .slice(-14, -7)
          .map((d) => d.value)
          .reduce((a, b) => a + b, 0)
      : null;
  const weekLoadDeltaPct =
    prevWeekLoad !== null && prevWeekLoad > 0
      ? Math.round(((weekLoad - prevWeekLoad) / prevWeekLoad) * 100)
      : null;

  const readinessValues = metricSeries(obs, 'readiness');
  const sleepValues = metricSeries(obs, 'sleep_duration');
  const checkinCount = readinessValues.length;

  const unlocks = unlockStates(historyDays, checkinCount);

  const acuteArr = ewmaSeries(daily, 7);
  const chronicArr = ewmaSeries(daily, 28);
  const acuteVal = acuteArr.at(-1)?.value ?? 0;
  const chronicVal = chronicArr.at(-1)?.value ?? 0;

  const acute7 = isUnlocked(unlocks, 'acute_load') ? round1(acuteVal) : null;
  const chronic28 = isUnlocked(unlocks, 'acwr_provisional') ? round1(chronicVal) : null;

  let acwrState: EngineSnapshot['acwr'] = null;
  if (isUnlocked(unlocks, 'acwr_provisional')) {
    const ratio = acwr(acuteVal, chronicVal);
    if (ratio !== null) {
      let yesterday: number | null = null;
      if (historyDays - 1 >= UNLOCK_THRESHOLDS.acwr_provisional) {
        const yAcute = acuteArr.at(-2)?.value;
        const yChronic = chronicArr.at(-2)?.value;
        const yRatio =
          yAcute !== undefined && yChronic !== undefined ? acwr(yAcute, yChronic) : null;
        yesterday = yRatio === null ? null : round2(yRatio);
      }
      acwrState = {
        value: round2(ratio),
        band: acwrBand(ratio),
        provisional: !isUnlocked(unlocks, 'acwr_full'),
        yesterday,
      };
    }
  }

  const monotonyVal = isUnlocked(unlocks, 'monotony') ? monotony(week) : null;
  const strainVal = isUnlocked(unlocks, 'monotony') ? strain(week) : null;

  let monotonyState: MonotonyState | null = null;
  if (monotonyVal !== null) {
    const rounded = round2(monotonyVal);
    monotonyState = {
      value: rounded,
      band: monotonyBand(rounded),
      display: monotonyDisplay(rounded),
    };
  }

  let strainState: StrainState | null = null;
  if (strainVal !== null) {
    const current = round1(strainVal);
    // Prior rolling 7d windows ending -7d/-14d/-21d; skip short or null-strain windows.
    const priors: number[] = [];
    for (let k = 1; k <= 3; k++) {
      const startIdx = daily.length - 7 * (k + 1);
      if (startIdx < 0) break;
      const windowLoads = daily.slice(startIdx, startIdx + 7).map((d) => d.value);
      const s = strain(windowLoads);
      if (s !== null) priors.push(round1(s));
    }
    if (priors.length > 0) {
      const all = [current, ...priors];
      strainState = {
        value: current,
        rank: 1 + all.filter((v) => v > current).length,
        of: all.length,
        rangeMin: Math.min(...all),
        rangeMax: Math.max(...all),
      };
    } else {
      strainState = { value: current, rank: null, of: null, rangeMin: null, rangeMax: null };
    }
  }

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
    prevWeekLoad,
    weekLoadDeltaPct,
    acute7,
    chronic28,
    acwr: acwrState,
    monotony: monotonyState,
    strain: strainState,
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
  if (!baselinesUnlocked) {
    return { value: todayValue.value, z: null, tier: null, baselineFormed: false };
  }

  const base = trailingBaseline(values, today);
  const formed = base !== null && base.count >= BASELINE_MIN_COUNT;
  const z = base !== null && formed ? zScore(todayValue.value, base) : null;
  const rounded = z === null ? null : round2(z);
  return {
    value: todayValue.value,
    z: rounded,
    tier: rounded === null ? null : zTier(rounded),
    baselineFormed: formed,
  };
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
