import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignalsCue } from './SignalsCue';

describe('SignalsCue', () => {
  it('shows a green dot and "sin señales" when the engine raises nothing', () => {
    const { container } = render(<SignalsCue summary={{ count: 0, worst: 'ok' }} />);
    expect(container.textContent).toContain('sin señales');
    expect(container.querySelector('.bg-ok')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('pluralizes, escalates the dot color, and links home when asked', () => {
    const { container } = render(<SignalsCue summary={{ count: 3, worst: 'high' }} linkToToday />);
    expect(container.textContent).toContain('3 señales activas');
    expect(container.querySelector('.bg-high')).not.toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
