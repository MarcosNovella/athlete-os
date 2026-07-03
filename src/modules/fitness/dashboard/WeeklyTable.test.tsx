import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeekSummary } from '@/modules/fitness/engine/trends';
import { WeeklyTable } from './WeeklyTable';

function week(overrides: Partial<WeekSummary>): WeekSummary {
  return {
    weekStart: '2026-06-22',
    totalLoad: 1000,
    loadDeltaPct: null,
    sessionCount: 4,
    avgSleep: 7.5,
    avgReadiness: 4,
    monotony: 1.2,
    monotonyBand: 'ok',
    monotonyDisplay: '1.2',
    strain: 1200,
    isPartial: false,
    ...overrides,
  };
}

describe('WeeklyTable', () => {
  const weeks: WeekSummary[] = [
    week({ weekStart: '2026-06-15' }),
    week({
      weekStart: '2026-06-22',
      totalLoad: 1400,
      loadDeltaPct: 40,
      monotony: 2.5,
      monotonyBand: 'high',
      monotonyDisplay: '2.5',
    }),
    week({ weekStart: '2026-06-29', totalLoad: 800, loadDeltaPct: 55, isPartial: true }),
  ];

  it('tints a completed-week load jump and the monotony band', () => {
    const { container } = render(<WeeklyTable weeks={weeks} />);
    const jump = [...container.querySelectorAll('span')].find((s) =>
      s.textContent?.includes('+40%'),
    );
    expect(jump?.className).toContain('text-flood');
    const monotonyCell = [...container.querySelectorAll('td')].find(
      (td) => td.textContent === '2.5',
    );
    expect(monotonyCell?.className).toContain('text-high');
  });

  it('reads partial weeks softly: marker shown, no caution tint on the delta', () => {
    const { container } = render(<WeeklyTable weeks={weeks} />);
    expect(container.textContent).toContain('parcial');
    const partialDelta = [...container.querySelectorAll('span')].find((s) =>
      s.textContent?.includes('+55%'),
    );
    expect(partialDelta?.className).toContain('text-faint');
    expect(partialDelta?.className).not.toContain('text-flood');
  });

  it('offers the column glossary in a details block', () => {
    const { container } = render(<WeeklyTable weeks={weeks} />);
    const summary = container.querySelector('details summary');
    expect(summary?.textContent).toContain('Qué significa');
    expect(container.querySelector('details')?.textContent).toContain('Monotonía');
  });
});
