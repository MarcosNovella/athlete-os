import type { EngineFlag, EngineSnapshot, MetricState } from '@/modules/fitness/engine/snapshot';
import type { UnlockKey } from '@/modules/fitness/engine/unlock';

/** "Estado de hoy" — the immediate reward (D12). Pure display → RSC (R1). */

const BAND_STYLE: Record<string, string> = {
  low: 'bg-zinc-100 text-zinc-600',
  optimal: 'bg-emerald-100 text-emerald-800',
  caution: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-700',
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
      return `Semana muy monótona (${flag.value}) — variá las cargas.`;
  }
}

function ZBadge({ state }: { state: NonNullable<MetricState> }) {
  if (state.z === null) {
    return (
      <span className="text-xs text-zinc-400">
        {state.baselineFormed ? '' : 'baseline formándose'}
      </span>
    );
  }
  const up = state.z >= 0.5;
  const down = state.z <= -0.5;
  return (
    <span
      className={`text-xs font-medium ${down ? 'text-red-600' : up ? 'text-emerald-700' : 'text-zinc-500'}`}
    >
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
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Estado de hoy</h2>
        <span className="text-xs text-zinc-400">día {snapshot.historyDays} de registro</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Carga hoy" value={`${snapshot.todayLoad} AU`} />
        <Stat label="Carga 7 días" value={`${snapshot.weekLoad} AU`} />
        {snapshot.readiness ? (
          <Stat
            label="Readiness"
            value={`${snapshot.readiness.value}/5`}
            extra={<ZBadge state={snapshot.readiness} />}
          />
        ) : (
          <Stat
            label="Readiness"
            value="—"
            extra={<span className="text-xs text-zinc-400">sin check-in hoy</span>}
          />
        )}
        {snapshot.sleep ? (
          <Stat
            label="Sueño"
            value={`${snapshot.sleep.value} h`}
            extra={<ZBadge state={snapshot.sleep} />}
          />
        ) : (
          <Stat label="Sueño" value="—" />
        )}
        {snapshot.acute7 !== null ? (
          <Stat label="Aguda (EWMA 7d)" value={`${snapshot.acute7} AU`} />
        ) : null}
        {snapshot.acwr !== null ? (
          <div className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">
              ACWR{snapshot.acwr.provisional ? ' (provisional)' : ''}
            </p>
            <p className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">{snapshot.acwr.value}</span>
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
            value={`${snapshot.monotony} · ${snapshot.strain ?? '—'}`}
          />
        ) : null}
      </div>

      {snapshot.flags.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {snapshot.flags.map((f) => (
            <li key={f.kind} className="rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
              {flagText(f)}
            </li>
          ))}
        </ul>
      ) : null}

      {lockedToShow.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
          {lockedToShow.map((u) => (
            <li key={u.key} className="flex items-center justify-between text-xs text-zinc-400">
              <span>🔒 {UNLOCK_LABEL[u.key]}</span>
              <span>
                {u.remaining} {u.key === 'baselines' ? 'check-ins' : 'días'} más
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {extra}
    </div>
  );
}
