import { GLOSSARY, type GlossaryKey } from './glossary';

/**
 * Tappable ⓘ → glossary card (roadmap §A.9). Native HTML popover: top-layer,
 * centered, light-dismiss on outside tap — zero client JS (ADR-015). Ids are
 * deterministic (no useId in RSC); pass `id` when a term repeats on a page.
 */
export function InfoTip({ term, id }: { term: GlossaryKey; id?: string }) {
  const pid = `gloss-${term}${id ? `-${id}` : ''}`;
  const entry = GLOSSARY[term];
  return (
    <>
      <button
        type="button"
        popoverTarget={pid}
        aria-label={`Qué significa ${entry.term}`}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-faint/60 font-mono text-[9px] leading-none text-faint"
      >
        i
      </button>
      <div
        id={pid}
        popover="auto"
        className="m-auto w-[calc(100vw-4rem)] max-w-xs rounded-xl border border-line bg-turf-2 p-4 shadow-2xl backdrop:bg-pitch/70"
      >
        <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-flood">
          {entry.term}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-chalk">{entry.definition}</p>
      </div>
    </>
  );
}
