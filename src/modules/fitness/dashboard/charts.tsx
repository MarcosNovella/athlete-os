import type { DatedValue } from '@/modules/fitness/engine/baselines';
import type { DayValue } from '@/modules/fitness/engine/load';

/** Server-rendered SVG charts (ADR-015): zero deps, zero client JS. */

const W = 360;
const H = 170;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 150;
const PLOT_LEFT = 6;
const PLOT_RIGHT = 354;

function fmtDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)}/${Number(m)}`;
}

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Daily load bars + acute (7d) and chronic (28d) EWMA lines. */
export function LoadChart({
  daily,
  acute,
  chronic,
}: {
  daily: ReadonlyArray<DayValue>;
  acute: ReadonlyArray<DayValue>;
  chronic: ReadonlyArray<DayValue>;
}) {
  const n = daily.length;
  if (n === 0) return <p className="text-sm text-faint">Sin datos todavía.</p>;

  const maxY = Math.max(1, ...daily.map((d) => d.value), ...acute.map((d) => d.value));
  const step = (PLOT_RIGHT - PLOT_LEFT) / n;
  const barW = Math.max(2, step * 0.62);
  const x = (i: number) => PLOT_LEFT + i * step + step / 2;
  const y = (v: number) => PLOT_BOTTOM - (v / maxY) * (PLOT_BOTTOM - PLOT_TOP);
  const line = (serie: ReadonlyArray<DayValue>) =>
    serie.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');

  const tickEvery = n > 14 ? 7 : 3;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Carga diaria y EWMA">
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_RIGHT}
          y2={PLOT_BOTTOM}
          className="stroke-line"
        />
        {daily.map((d, i) => (
          <rect
            key={d.date}
            x={x(i) - barW / 2}
            y={y(d.value)}
            width={barW}
            height={Math.max(0, PLOT_BOTTOM - y(d.value))}
            className="fill-line"
          />
        ))}
        <polyline
          points={line(chronic)}
          fill="none"
          strokeDasharray="4 3"
          className="stroke-dim"
          strokeWidth="1.5"
        />
        <polyline points={line(acute)} fill="none" className="stroke-flood" strokeWidth="2" />
        {daily.map((d, i) =>
          i % tickEvery === 0 ? (
            <text
              key={d.date}
              x={x(i)}
              y={H - 4}
              textAnchor="middle"
              className="fill-faint font-mono text-[9px]"
            >
              {fmtDay(d.date)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-line" /> carga diaria
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-flood" /> aguda 7d
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-dim" /> crónica 28d
        </span>
      </div>
    </div>
  );
}

/* ---- ACWR gauge (roadmap §A.1) ---- */

const GAUGE_LEFT = 10;
const GAUGE_RIGHT = 350;
/** Display ceiling only — stored ACWR values are never clamped. */
export const GAUGE_MAX = 2;

/** Pure x-position on the 0→GAUGE_MAX scale, clamped to the track. */
export function gaugeX(value: number): number {
  const clamped = Math.min(GAUGE_MAX, Math.max(0, value));
  return GAUGE_LEFT + (clamped / GAUGE_MAX) * (GAUGE_RIGHT - GAUGE_LEFT);
}

const GAUGE_ZONES = [
  { from: 0, to: 0.8, cls: 'fill-line/40' },
  { from: 0.8, to: 1.3, cls: 'fill-ok/15' },
  { from: 1.3, to: 1.5, cls: 'fill-flood/15' },
  { from: 1.5, to: 2, cls: 'fill-high/15' },
] as const;

const GAUGE_TICKS = [0, 0.8, 1.3, 1.5, 2] as const;

/** Horizontal ACWR scale with shaded zones, today marker and yesterday ghost. */
export function AcwrGauge({ value, yesterday }: { value: number; yesterday: number | null }) {
  const trackTop = 16;
  const trackBottom = 30;
  // Keep the value label inside the viewBox even at the extremes.
  const labelX = Math.min(GAUGE_RIGHT - 12, Math.max(GAUGE_LEFT + 12, gaugeX(value)));
  return (
    <svg
      viewBox="0 0 360 46"
      className="w-full"
      role="img"
      aria-label={`ACWR ${value} en escala 0 a 2`}
    >
      {GAUGE_ZONES.map((z) => (
        <rect
          key={z.from}
          x={gaugeX(z.from)}
          y={trackTop}
          width={gaugeX(z.to) - gaugeX(z.from)}
          height={trackBottom - trackTop}
          className={z.cls}
        />
      ))}
      {GAUGE_TICKS.map((t) => (
        <g key={t}>
          <line
            x1={gaugeX(t)}
            y1={trackBottom}
            x2={gaugeX(t)}
            y2={trackBottom + 3}
            className="stroke-line"
          />
          <text
            x={gaugeX(t)}
            y={44}
            textAnchor="middle"
            className="fill-faint font-mono text-[8px]"
          >
            {t}
          </text>
        </g>
      ))}
      {yesterday !== null ? (
        <line
          data-marker="yesterday"
          x1={gaugeX(yesterday)}
          y1={trackTop - 2}
          x2={gaugeX(yesterday)}
          y2={trackBottom + 2}
          className="stroke-chalk/40"
          strokeWidth="1.5"
        />
      ) : null}
      <line
        data-marker="today"
        x1={gaugeX(value)}
        y1={trackTop - 3}
        x2={gaugeX(value)}
        y2={trackBottom + 3}
        className="stroke-chalk"
        strokeWidth="2"
      />
      <text
        x={labelX}
        y={trackTop - 6}
        textAnchor="middle"
        className="fill-chalk font-mono text-[10px] font-semibold"
      >
        {value > GAUGE_MAX ? `${value} »` : value}
      </text>
    </svg>
  );
}

/**
 * Small line chart for a daily check-in metric over the last 28 days.
 * Gaps stay visual gaps: the line only connects CONSECUTIVE days.
 */
export function MetricChart({
  points,
  windowStart,
  today,
  yMin,
  yMax,
  mean,
  strokeClass,
  label,
}: {
  points: ReadonlyArray<DatedValue>;
  windowStart: string;
  today: string;
  yMin: number;
  yMax: number;
  mean: number | null;
  strokeClass: string;
  label: string;
}) {
  if (points.length === 0) return <p className="text-sm text-faint">Sin datos todavía.</p>;

  const nDays = diffDays(windowStart, today) + 1;
  const step = (PLOT_RIGHT - PLOT_LEFT) / nDays;
  const x = (date: string) => PLOT_LEFT + diffDays(windowStart, date) * step + step / 2;
  const height = 120;
  const bottom = height - 18;
  const y = (v: number) => bottom - ((v - yMin) / (yMax - yMin)) * (bottom - 8);

  // Split into runs of consecutive days so gaps are visible.
  const segments: DatedValue[][] = [];
  let current: DatedValue[] = [];
  let prevDate: string | null = null;
  for (const p of points) {
    if (prevDate !== null && diffDays(prevDate, p.date) !== 1 && current.length > 0) {
      segments.push(current);
      current = [];
    }
    current.push(p);
    prevDate = p.date;
  }
  if (current.length > 0) segments.push(current);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={label}>
      <line x1={PLOT_LEFT} y1={bottom} x2={PLOT_RIGHT} y2={bottom} className="stroke-line" />
      {mean !== null ? (
        <line
          x1={PLOT_LEFT}
          y1={y(mean)}
          x2={PLOT_RIGHT}
          y2={y(mean)}
          strokeDasharray="3 3"
          className="stroke-faint"
        />
      ) : null}
      {segments.map((seg) => (
        <polyline
          key={seg[0]?.date ?? 'seg'}
          points={seg.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
          fill="none"
          className={strokeClass}
          strokeWidth="2"
        />
      ))}
      {points.map((p) => (
        <circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.value)}
          r="2.4"
          className={`${strokeClass} fill-turf`}
        />
      ))}
      <text x={PLOT_LEFT} y={height - 4} className="fill-faint font-mono text-[9px]">
        {fmtDay(windowStart)}
      </text>
      <text
        x={PLOT_RIGHT}
        y={height - 4}
        textAnchor="end"
        className="fill-faint font-mono text-[9px]"
      >
        {fmtDay(today)}
      </text>
    </svg>
  );
}
