import Link from 'next/link';
import type { SignalSummary } from '@/modules/fitness/engine/snapshot';

/**
 * Header cue (roadmap §A.8): dot + "N señales activas". Framed as SEÑALES,
 * never a verdict (ADR-012); severity/color comes pre-computed from the engine.
 */

const DOT: Record<SignalSummary['worst'], string> = {
  ok: 'bg-ok',
  caution: 'bg-flood',
  high: 'bg-high',
};

export function SignalsCue({
  summary,
  linkToToday = false,
}: {
  summary: SignalSummary;
  linkToToday?: boolean;
}) {
  const text =
    summary.count === 0
      ? 'sin señales'
      : summary.count === 1
        ? '1 señal activa'
        : `${summary.count} señales activas`;

  const body = (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
      <span className={`inline-block h-2 w-2 rounded-full ${DOT[summary.worst]}`} />
      {text}
    </span>
  );

  if (!linkToToday) return body;
  return (
    <Link href="/" className="underline-offset-2 hover:underline">
      {body}
    </Link>
  );
}
