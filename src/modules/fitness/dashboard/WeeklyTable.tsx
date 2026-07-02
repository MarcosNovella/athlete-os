import type { WeekSummary } from '@/modules/fitness/engine/trends';

function fmtDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)}/${Number(m)}`;
}

export function WeeklyTable({ weeks }: { weeks: ReadonlyArray<WeekSummary> }) {
  if (weeks.length === 0) return <p className="text-sm text-faint">Sin semanas todavía.</p>;

  return (
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
        {[...weeks].reverse().map((w) => (
          <tr key={w.weekStart} className="border-t border-line">
            <td className="py-2 font-mono text-xs text-dim">{fmtDay(w.weekStart)}</td>
            <td className="py-2 text-right font-display text-base font-semibold tabular-nums">
              {w.totalLoad}
            </td>
            <td className="py-2 text-right tabular-nums text-dim">{w.sessionCount}</td>
            <td className="py-2 text-right tabular-nums text-dim">{w.avgSleep ?? '—'}</td>
            <td className="py-2 text-right tabular-nums text-dim">{w.avgReadiness ?? '—'}</td>
            <td className="py-2 text-right tabular-nums text-dim">{w.monotony ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
