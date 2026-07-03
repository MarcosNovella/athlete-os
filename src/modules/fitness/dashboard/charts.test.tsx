import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AcwrChart, AcwrGauge, GAUGE_MAX, gaugeX, MetricChart } from './charts';

describe('gaugeX', () => {
  it('is monotonic on the 0→2 track and clamps outside it', () => {
    expect(gaugeX(0.8)).toBeGreaterThan(gaugeX(0));
    expect(gaugeX(1.3)).toBeGreaterThan(gaugeX(0.8));
    expect(gaugeX(GAUGE_MAX)).toBeGreaterThan(gaugeX(1.5));
    expect(gaugeX(2.5)).toBe(gaugeX(GAUGE_MAX));
    expect(gaugeX(-1)).toBe(gaugeX(0));
  });
});

describe('AcwrGauge', () => {
  it('renders 4 zone rects and the today marker at gaugeX(value)', () => {
    const { container } = render(<AcwrGauge value={1.55} yesterday={null} />);
    expect(container.querySelectorAll('rect').length).toBe(4);
    const marker = container.querySelector('[data-marker="today"]');
    expect(marker?.getAttribute('x1')).toBe(String(gaugeX(1.55)));
    expect(container.querySelector('[data-marker="yesterday"]')).toBeNull();
  });

  it('shows the yesterday ghost only when provided, and cues clamped values', () => {
    const { container } = render(<AcwrGauge value={2.31} yesterday={1.5} />);
    const ghost = container.querySelector('[data-marker="yesterday"]');
    expect(ghost?.getAttribute('x1')).toBe(String(gaugeX(1.5)));
    // Value above the track clamps the marker but the label says so.
    const marker = container.querySelector('[data-marker="today"]');
    expect(marker?.getAttribute('x1')).toBe(String(gaugeX(GAUGE_MAX)));
    expect(container.textContent).toContain('2.31 »');
  });
});

describe('AcwrChart', () => {
  it('renders zone bands and splits the line across gated gaps', () => {
    const points = [
      { date: '2026-06-14', value: 1.0 },
      { date: '2026-06-15', value: 1.1 },
      // gap (missing 16th) — line must break
      { date: '2026-06-17', value: 1.2 },
    ];
    const { container } = render(
      <AcwrChart points={points} windowStart="2026-06-01" today="2026-06-28" />,
    );
    expect(container.querySelectorAll('rect').length).toBe(4); // the 4 zones
    expect(container.querySelectorAll('polyline').length).toBe(2); // 2 segments
  });

  it('shows the empty state text when the series is empty', () => {
    const { container } = render(
      <AcwrChart points={[]} windowStart="2026-06-01" today="2026-06-28" />,
    );
    expect(container.textContent).toContain('Sin datos');
  });
});

describe('MetricChart', () => {
  const sparsePoints = [
    { date: '2026-06-01', value: 82.0 },
    // gap of several days — a dense chart would break the line here
    { date: '2026-06-10', value: 81.5 },
  ];

  it('breaks the line at gaps by default', () => {
    const { container } = render(
      <MetricChart
        points={sparsePoints}
        windowStart="2026-06-01"
        today="2026-06-10"
        yMin={80}
        yMax={83}
        mean={null}
        strokeClass="stroke-chalk"
        label="test"
      />,
    );
    // Each point is its own segment (no consecutive day pair) → 2 polylines.
    expect(container.querySelectorAll('polyline').length).toBe(2);
  });

  it('connects gaps into one line when connectGaps is set', () => {
    const { container } = render(
      <MetricChart
        points={sparsePoints}
        windowStart="2026-06-01"
        today="2026-06-10"
        yMin={80}
        yMax={83}
        mean={null}
        strokeClass="stroke-chalk"
        label="test"
        connectGaps
      />,
    );
    expect(container.querySelectorAll('polyline').length).toBe(1);
  });

  it('pads a flat series (yMax === yMin) instead of producing NaN paths', () => {
    const { container } = render(
      <MetricChart
        points={[{ date: '2026-06-01', value: 5 }]}
        windowStart="2026-06-01"
        today="2026-06-01"
        yMin={5}
        yMax={5}
        mean={null}
        strokeClass="stroke-chalk"
        label="test"
      />,
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('cy')).not.toContain('NaN');
  });

  it('shows the empty state text when the series is empty', () => {
    const { container } = render(
      <MetricChart
        points={[]}
        windowStart="2026-06-01"
        today="2026-06-10"
        yMin={0}
        yMax={5}
        mean={null}
        strokeClass="stroke-chalk"
        label="test"
      />,
    );
    expect(container.textContent).toContain('Sin datos');
  });
});
