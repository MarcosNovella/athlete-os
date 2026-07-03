import { monotonyDisplay } from '@/modules/fitness/engine/load';
import type { EngineFlag, EngineSnapshot, MetricState } from '@/modules/fitness/engine/snapshot';
import type { UnlockKey } from '@/modules/fitness/engine/unlock';

/** "Estado de hoy" — the immediate reward (D12). Pure display → RSC (R1). */

const BAND_STYLE: Record<string, string> = {
  low: 'bg-turf-2 text-dim',
  optimal: 'bg-ok/15 text-ok',
  caution: 'bg-flood/15 text-flood',
  high: 'bg-high/15 text-high',
};

const BAND_LABEL: Record<string, string> = {
  low: 'baja',
  optimal: 'óptima',
  caution: 'precaución',
  high: 'alta',
};

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
  if (state.z === null) {
    return (
      <span className="font-mono text-[10px] text-faint">
        {state.baselineFormed ? '' : 'baseline formándose'}
      </span>
    );
  }
  const up = state.z >= 0.5;
  const down = state.z <= -0.5;
  return (
    <span className={`text-xs font-medium ${down ? 'text-high' : up ? 'text-ok' : 'text-dim'}`}>
      {down ? '↓ bajo tu media' : up ? '↑ sobre tu media' : '→ en tu media'}
    </span>
  );
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
            value={String(snapshot.readiness.value)}
            unit="/5"
            extra={<ZBadge state={snapshot.readiness} />}
          />
        ) : (
          <Hero
            label="Readiness"
            value="—"
            unit=""
            extra={<span className="font-mono text-[10px] text-faint">sin check-in hoy</span>}
          />
        )}
        {snapshot.sleep ? (
          <Hero
            label="Sueño"
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
        <Stat label="Carga hoy" value={`${snapshot.todayLoad}`} unit="AU" />
        <Stat label="Carga 7 días" value={`${snapshot.weekLoad}`} unit="AU" />
        {snapshot.acute7 !== null ? (
          <Stat label="Aguda · EWMA 7d" value={`${snapshot.acute7}`} unit="AU" />
        ) : null}
        {snapshot.acwr !== null ? (
          <div className="rounded-lg bg-turf-2 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-faint">
              ACWR{snapshot.acwr.provisional ? ' · provisional' : ''}
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
          </div>
        ) : null}
        {snapshot.monotony !== null ? (
          <Stat
            label="Monotonía · Strain"
            value={`${snapshot.monotony.display} · ${snapshot.strain?.value ?? '—'}`}
          />
        ) : null}
      </div>

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
}: {
  label: string;
  value: string;
  unit: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-turf-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 font-display text-4xl font-semibold leading-none tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-lg font-medium text-dim">{unit}</span> : null}
      </p>
      <div className="mt-1 min-h-4">{extra}</div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg bg-turf-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-semibold leading-none tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-sm font-medium text-dim">{unit}</span> : null}
      </p>
    </div>
  );
}
