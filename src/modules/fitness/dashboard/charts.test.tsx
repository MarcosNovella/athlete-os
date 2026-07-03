import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AcwrGauge, GAUGE_MAX, gaugeX } from './charts';

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
