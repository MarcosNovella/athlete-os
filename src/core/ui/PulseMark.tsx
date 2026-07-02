/**
 * The identity mark: the readiness pulse from the app icon.
 * `animate` draws the line once (check-in reward moment); the .pulse-draw
 * class respects prefers-reduced-motion in globals.css.
 */
export function PulseMark({
  className,
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg viewBox="0 0 32 20" className={className} aria-hidden="true">
      <path
        d="M1 12h8l3.2-9 4.6 15 2.6-8.6 1.8 2.6H31"
        pathLength={100}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animate ? 'pulse-draw' : undefined}
      />
    </svg>
  );
}
