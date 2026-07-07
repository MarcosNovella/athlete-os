import type { PatternCandidate, PatternsData } from '@/modules/fitness/engine/patterns';
import { PATTERN_CAVEAT } from '@/modules/fitness/engine/patterns';
import { InfoTip } from './InfoTip';

/** Two dots (bin means) + connecting bar + n labels — server-rendered SVG (ADR-015). */
function PatternDumbbell({ candidate }: { candidate: PatternCandidate }) {
  const { pair, result } = candidate;
  const a = result.exposedMean as number;
  const b = result.referenceMean as number;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const pad = Math.max(hi - lo, 0.5) * 0.4;
  const scaleMin = lo - pad;
  const scaleMax = hi + pad;

  const W = 300;
  const H = 56;
  const left = 16;
  const right = W - 16;
  const midY = 26;
  const x = (v: number): number =>
    scaleMax === scaleMin
      ? (left + right) / 2
      : left + ((v - scaleMin) / (scaleMax - scaleMin)) * (right - left);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${pair.outcomePhrase}: ${a}${pair.outcomeUnit} en días expuestos vs ${b}${pair.outcomeUnit} en los demás días`}
    >
      <line x1={x(a)} y1={midY} x2={x(b)} y2={midY} className="stroke-line" strokeWidth="2" />
      <circle cx={x(a)} cy={midY} r="5" className="fill-flood" />
      <circle cx={x(b)} cy={midY} r="5" className="fill-dim" />
      <text
        x={x(a)}
        y={midY - 12}
        textAnchor="middle"
        className="fill-flood font-mono text-[10px] font-semibold"
      >
        {a}
        {pair.outcomeUnit}
      </text>
      <text x={x(a)} y={midY + 18} textAnchor="middle" className="fill-faint font-mono text-[9px]">
        n={result.nExposed}
      </text>
      <text
        x={x(b)}
        y={midY - 12}
        textAnchor="middle"
        className="fill-dim font-mono text-[10px] font-semibold"
      >
        {b}
        {pair.outcomeUnit}
      </text>
      <text x={x(b)} y={midY + 18} textAnchor="middle" className="fill-faint font-mono text-[9px]">
        n={result.nReference}
      </text>
    </svg>
  );
}

function CandidateCard({ candidate, cardId }: { candidate: PatternCandidate; cardId: string }) {
  const { pair, result, statement } = candidate;
  return (
    <li className="rounded-lg border border-line bg-turf-2 p-3">
      <p className="text-sm text-chalk">{statement}</p>
      <div className="mt-2">
        <PatternDumbbell candidate={candidate} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
        <span className="flex items-center gap-1">
          patrón <InfoTip term="patron" id={cardId} />
        </span>
        <span className="flex items-center gap-1">
          efecto {result.cohensD} <InfoTip term="efecto" id={cardId} />
        </span>
        <span className="flex items-center gap-1">
          n <InfoTip term="n" id={cardId} />
        </span>
      </div>
      <p className="mt-2 text-xs text-faint">{pair.confounders}</p>
    </li>
  );
}

/** /patrones (roadmap §B, V2.3 ADR-025): renders the 3 states from PatternsData only. Zero client JS. */
export function PatternsSection({ data }: { data: PatternsData }) {
  if (data.locked) {
    return (
      <section className="rounded-xl border border-line bg-turf p-4">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Patrones
        </h2>
        <p className="text-sm text-faint">
          Se desbloquea con {data.remainingDays} días más de historia — necesitamos ~8 semanas para
          comparar tus días con datos suficientes.
        </p>
      </section>
    );
  }

  if (data.surfaced.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-turf p-4">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Patrones
        </h2>
        <p className="text-sm text-faint">
          Sin patrones claros todavía — {data.evaluatedCount} pares vigilados, seguí registrando.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-turf p-4">
      <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
        Patrones
      </h2>
      <ul className="space-y-3">
        {data.surfaced.map((c) => (
          <CandidateCard key={c.pair.id} candidate={c} cardId={c.pair.id} />
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">{PATTERN_CAVEAT}</p>
    </section>
  );
}
