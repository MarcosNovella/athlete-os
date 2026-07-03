import type { ZTier } from '@/modules/fitness/engine/baselines';
import {
  type AcwrBand,
  formatDeltaPct,
  type MonotonyBand,
  monotonyDisplay,
} from '@/modules/fitness/engine/load';
import type {
  EngineFlag,
  EngineSnapshot,
  MetricState,
  StrainState,
} from '@/modules/fitness/engine/snapshot';
import type { UnlockKey } from '@/modules/fitness/engine/unlock';
import { AcwrGauge } from './charts';
import { InfoTip } from './InfoTip';

/** "Estado de hoy" — the immediate reward (D12). Pure display → RSC (R1). */

const BAND_STYLE: Record<AcwrBand, string> = {
  low: 'bg-turf-2 text-dim',
  optimal: 'bg-ok/15 text-ok',
  caution: 'bg-flood/15 text-flood',
  high: 'bg-high/15 text-high',
};

const BAND_LABEL: Record<AcwrBand, string> = {
  low: 'baja',
  optimal: 'óptima',
  caution: 'precaución',
  high: 'alta',
};

const MONOTONY_BAND_STYLE: Record<MonotonyBand, string> = {
  ok: 'bg-ok/15 text-ok',
  caution: 'bg-flood/15 text-flood',
  high: 'bg-high/15 text-high',
};

const MONOTONY_BAND_LABEL: Record<MonotonyBand, string> = {
  ok: 'ok',
  caution: 'precaución',
  high: 'alta',
};

const TIER_UI: Record<ZTier, { cls: string; text: string }> = {
  way_below: { cls: 'text-high', text: '↓↓ MUY bajo tu media' },
  below: { cls: 'text-flood', text: '↓ bajo tu media' },
  typical: { cls: 'text-dim', text: '→ en tu media' },
  above: { cls: 'text-ok', text: '↑ sobre tu media' },
  way_above: { cls: 'text-ok', text: '↑↑ MUY sobre tu media' },
};

/** Personal rank framing — mirrors the briefing wording (same story). */
function strainRankText(s: StrainState): string {
  if (s.rank === null || s.of === null) return 'aún sin semanas comparables';
  if (s.rank === 1) return `la más alta de tus últimas ${s.of} semanas`;
  if (s.rank === s.of) return `la más baja de tus últimas ${s.of} semanas`;
  return `puesto ${s.rank} de tus últimas ${s.of} semanas`;
}

const UNLOCK_LABEL: Record<UnlockKey, string> = {
  acute_load: 'Carga aguda (7d)',
  monotony: 'Monotonía y strain',
  acwr_provisional: 'ACWR provisional',
  acwr_full: 'ACWR completo',
  baselines: 'Baselines personales',
};

function flagText(flag: EngineFlag): string {
  switch (flag.kind) {
    case 'acwr':
      return `Tu carga aguda está ${flag.band === 'high' ? 'muy alta' : 'alta'} respecto de tu base (ACWR ${flag.value}) — ojo con el salto de carga.`;
    case 'readiness_drop':
      return 'Readiness por debajo de tu base hace 2+ días — priorizá recuperación.';
    case 'monotony_high':
      return `Semana muy monótona (${monotonyDisplay(flag.value)}) — variá las cargas.`;
  }
}

function ZBadge({ state }: { state: NonNullable<MetricState> }) {
  if (state.tier === null) {
    return (
      <span className="font-mono text-[10px] text-faint">
        {state.baselineFormed ? '' : 'baseline formándose'}
      </span>
    );
  }
  const tier = TIER_UI[state.tier];
  return <span className={`text-xs font-medium ${tier.cls}`}>{tier.text}</span>;
}

export function TodayStatePanel({ snapshot }: { snapshot: EngineSnapshot }) {
  const locked = snapshot.unlocks.filter((u) => !u.unlocked);
  // Don't show the provisional lock once the full one is the only difference.
  const lockedToShow = locked.filter(
    (u) => !(u.key === 'acwr_provisional' && snapshot.acwr !== null),
  );

  return (
    <section className="rounded-xl border border-line bg-turf p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Estado de hoy
        </h2>
        <span className="font-mono text-[10px] text-faint">día {snapshot.historyDays}</span>
      </div>

      {/* Hero pair: how the athlete IS — readiness and sleep, scoreboard-size. */}
      <div className="grid grid-cols-2 gap-2">
        {snapshot.readiness ? (
          <Hero
            label="Readiness"
            info={<InfoTip term="readiness" />}
            value={String(snapshot.readiness.value)}
            unit="/5"
            extra={<ZBadge state={snapshot.readiness} />}
          />
        ) : (
          <Hero
            label="Readiness"
            info={<InfoTip term="readiness" />}
            value="—"
            unit=""
            extra={<span className="font-mono text-[10px] text-faint">sin check-in hoy</span>}
          />
        )}
        {snapshot.sleep ? (
          <Hero
            label="Sueño"
            info={<InfoTip term="baseline" />}
            value={String(snapshot.sleep.value)}
            unit="h"
            extra={<ZBadge state={snapshot.sleep} />}
          />
        ) : (
          <Hero label="Sueño" value="—" unit="" />
        )}
      </div>

      {/* Load numbers: what the athlete DID. */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat
          label="Carga hoy"
          info={<InfoTip term="au" />}
          value={`${snapshot.todayLoad}`}
          unit="AU"
        />
        <Stat
          label="Carga 7 días"
          value={`${snapshot.weekLoad}`}
          unit="AU"
          extra={
            snapshot.weekLoadDeltaPct !== null ? (
              <span className="text-xs text-dim">
                {formatDeltaPct(snapshot.weekLoadDeltaPct)} vs semana previa
              </span>
            ) : null
          }
        />
        {snapshot.acute7 !== null ? (
          <Stat
            label="Aguda · EWMA 7d"
            info={<InfoTip term="ewma" />}
            value={`${snapshot.acute7}`}
            unit="AU"
          />
        ) : null}
        {snapshot.monotony !== null ? (
          <Stat
            label="Monotonía"
            info={<InfoTip term="monotony" />}
            value={snapshot.monotony.display}
            extra={
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${MONOTONY_BAND_STYLE[snapshot.monotony.band]}`}
              >
                {MONOTONY_BAND_LABEL[snapshot.monotony.band]}
              </span>
            }
          />
        ) : null}
        {snapshot.strain !== null ? (
          <Stat
            label="Strain"
            info={<InfoTip term="strain" />}
            value={String(Math.round(snapshot.strain.value))}
            extra={<span className="text-xs text-dim">{strainRankText(snapshot.strain)}</span>}
          />
        ) : null}
      </div>

      {snapshot.acwr !== null ? (
        <div className="mt-2 rounded-lg bg-turf-2 p-3">
          <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-faint">
            <span>ACWR{snapshot.acwr.provisional ? ' · provisional' : ''}</span>
            <InfoTip term="acwr" />
          </p>
          <p className="mt-0.5 flex items-center gap-2">
            <span className="font-display text-2xl font-semibold tabular-nums">
              {snapshot.acwr.value}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLE[snapshot.acwr.band]}`}
            >
              {BAND_LABEL[snapshot.acwr.band]}
            </span>
          </p>
          <AcwrGauge value={snapshot.acwr.value} yesterday={snapshot.acwr.yesterday} />
        </div>
      ) : null}

      {snapshot.flags.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {snapshot.flags.map((f) => (
            <li
              key={f.kind}
              className="rounded-lg border border-flood/30 bg-flood/10 p-2.5 text-sm text-chalk"
            >
              {flagText(f)}
            </li>
          ))}
        </ul>
      ) : null}

      {lockedToShow.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {lockedToShow.map((u) => (
            <li key={u.key} className="flex items-center justify-between text-xs text-faint">
              <span>{UNLOCK_LABEL[u.key]}</span>
              <span className="font-mono text-[10px]">
                {u.remaining} {u.key === 'baselines' ? 'check-ins' : 'días'} más
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Hero({
  label,
  value,
  unit,
  extra,
  info,
}: {
  label: string;
  value: string;
  unit: string;
  extra?: React.ReactNode;
  info?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-turf-2 p-3">
      <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-faint">
        <span>{label}</span>
        {info}
      </p>
      <p className="mt-0.5 font-display text-4xl font-semibold leading-none tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-lg font-medium text-dim">{unit}</span> : null}
      </p>
      <div className="mt-1 min-h-4">{extra}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  extra,
  info,
}: {
  label: string;
  value: string;
  unit?: string;
  extra?: React.ReactNode;
  info?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-turf-2 p-3">
      <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-faint">
        <span>{label}</span>
        {info}
      </p>
      <p className="mt-0.5 font-display text-2xl font-semibold leading-none tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-sm font-medium text-dim">{unit}</span> : null}
      </p>
      {extra !== undefined && extra !== null ? <div className="mt-1">{extra}</div> : null}
    </div>
  );
}
