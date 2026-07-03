import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary';
import { InfoTip } from './InfoTip';

describe('InfoTip', () => {
  it('wires the button to its popover and renders the glossary copy', () => {
    const { container } = render(<InfoTip term="acwr" />);
    const btn = container.querySelector('button');
    expect(btn?.getAttribute('popovertarget')).toBe('gloss-acwr');
    const pop = container.querySelector('#gloss-acwr');
    expect(pop).not.toBeNull();
    expect(pop?.getAttribute('popover')).toBe('auto');
    expect(pop?.textContent).toContain(GLOSSARY.acwr.term);
    expect(pop?.textContent).toContain('nunca un veredicto');
  });

  it('keeps ids unique when the same term appears twice on a page', () => {
    const { container } = render(
      <>
        <InfoTip term="au" />
        <InfoTip term="au" id="table" />
      </>,
    );
    expect(container.querySelector('#gloss-au')).not.toBeNull();
    expect(container.querySelector('#gloss-au-table')).not.toBeNull();
    const buttons = container.querySelectorAll('button[popovertarget]');
    const targets = [...buttons].map((b) => b.getAttribute('popovertarget'));
    expect(new Set(targets).size).toBe(2);
  });
});
