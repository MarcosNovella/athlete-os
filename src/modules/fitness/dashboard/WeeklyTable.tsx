import { formatDeltaPct, type MonotonyBand, weekLoadJumpBand } from '@/modules/fitness/engine/load';
import type { WeekSummary } from '@/modules/fitness/engine/trends';
import { GLOSSARY } from './glossary';

function fmtDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)}/${Number(m)}`;
}

const MONOTONY_TINT: Record<MonotonyBand, string> = {
  ok: 'text-dim',
  caution: 'text-flood',
  high: 'text-high',
};

const COLUMN_GLOSSARY = ['au', 'monotony', 'readiness'] as const;

export function WeeklyTable({ weeks }: { weeks: ReadonlyArray<WeekSummary> }) {
  if (weeks.length === 0) return <p className="text-sm text-faint">Sin semanas todavía.</p>;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-faint">
            <th className="pb-2 font-normal">Semana</th>
            <th className="pb-2 text-right font-normal">Carga</th>
            <th className="pb-2 text-right font-normal">Ses.</th>
            <th className="pb-2 text-right font-normal">Sueño</th>
            <th className="pb-2 text-right font-normal">Read.</th>
            <th className="pb-2 text-right font-normal">Monot.</th>
          </tr>
        </thead>
        <tbody>
          {[...weeks].reverse().map((w) => {
            // Partial weeks read softly: no caution tint on an unfinished delta.
            const deltaTint =
              w.loadDeltaPct !== null &&
              !w.isPartial &&
              weekLoadJumpBand(w.loadDeltaPct) === 'caution'
                ? 'text-flood'
                : 'text-faint';
            return (
              <tr key={w.weekStart} className="border-t border-line">
                <td className="py-2 font-mono text-xs text-dim">
                  {fmtDay(w.weekStart)}
                  {w.isPartial ? (
                    <span className="ml-1 text-[9px] uppercase text-faint">parcial</span>
                  ) : null}
                </td>
                <td className="py-2 text-right font-display text-base font-semibold tabular-nums">
                  {w.totalLoad}
                  {w.loadDeltaPct !== null ? (
                    <span className={`block font-sans text-[10px] font-normal ${deltaTint}`}>
                      {formatDeltaPct(w.loadDeltaPct)}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums text-dim">{w.sessionCount}</td>
                <td className="py-2 text-right tabular-nums text-dim">{w.avgSleep ?? '—'}</td>
                <td className="py-2 text-right tabular-nums text-dim">{w.avgReadiness ?? '—'}</td>
                <td
                  className={`py-2 text-right tabular-nums ${w.monotonyBand !== null ? MONOTONY_TINT[w.monotonyBand] : 'text-dim'}`}
                >
                  {w.monotonyDisplay ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-dim">¿Qué significa cada columna?</summary>
        <dl className="mt-2 space-y-2 text-xs leading-relaxed text-dim">
          {COLUMN_GLOSSARY.map((key) => (
            <div key={key}>
              <dt className="font-semibold text-chalk">{GLOSSARY[key].term}</dt>
              <dd>{GLOSSARY[key].definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
