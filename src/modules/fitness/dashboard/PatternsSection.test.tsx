import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  PatternCandidate,
  PatternPair,
  PatternResult,
  PatternsData,
} from '@/modules/fitness/engine/patterns';
import { formatCandidateEs } from '@/modules/fitness/engine/patterns';
import { PatternsSection } from './PatternsSection';

const pair: PatternPair = {
  id: 'sleep_duration_low_readiness',
  predictor: 'sleep_duration',
  binMode: 'below_mean',
  outcomeKey: 'readiness',
  lagDays: 0,
  predictorPhrase: 'En los días que dormís menos que tu media',
  outcomePhrase: 'readiness',
  outcomeUnit: '/5',
  minRawDiff: 0.4,
  confounders: 'Puede reflejar estrés o rutina cargada, no solo horas de sueño.',
};

const result: PatternResult = {
  pairId: pair.id,
  status: 'candidate',
  nExposed: 20,
  nReference: 40,
  exposedMean: 2.6,
  referenceMean: 4.0,
  diff: -1.4,
  cohensD: -1.1,
  rho: 0.5,
};

function candidate(overrides: Partial<PatternResult> = {}): PatternCandidate {
  const r = { ...result, ...overrides };
  return { pair, result: r, statement: formatCandidateEs(pair, r) };
}

function data(overrides: Partial<PatternsData> = {}): PatternsData {
  return {
    historyDays: 60,
    locked: false,
    remainingDays: 0,
    evaluatedCount: 15,
    results: [],
    surfaced: [],
    ...overrides,
  };
}

describe('PatternsSection', () => {
  it('renders a locked countdown card', () => {
    const { getByText } = render(
      <PatternsSection data={data({ locked: true, remainingDays: 12, evaluatedCount: 0 })} />,
    );
    expect(getByText(/12 días más/)).toBeTruthy();
  });

  it('renders the empty state with the evaluated-pair count', () => {
    const { getByText } = render(
      <PatternsSection data={data({ surfaced: [], evaluatedCount: 15 })} />,
    );
    expect(getByText(/Sin patrones claros todavía/)).toBeTruthy();
    expect(getByText(/15 pares vigilados/)).toBeTruthy();
  });

  it('renders a candidate card with its statement, n, and confounders', () => {
    const c = candidate();
    const { getByText, container } = render(<PatternsSection data={data({ surfaced: [c] })} />);
    expect(getByText(c.statement)).toBeTruthy();
    expect(getByText(pair.confounders)).toBeTruthy();
    expect(container.querySelector('svg[role="img"]')).toBeTruthy();
  });

  it('gives each InfoTip a unique id per candidate card', () => {
    const c1 = candidate();
    const c2 = candidate({ ...result, pairId: 'alcohol_readiness' });
    const c2WithPair: PatternCandidate = {
      ...c2,
      pair: { ...pair, id: 'alcohol_readiness' },
    };
    const { container } = render(<PatternsSection data={data({ surfaced: [c1, c2WithPair] })} />);
    const ids = [...container.querySelectorAll('[popover]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders at most the surfaced candidates (never more than top-K)', () => {
    const many = [candidate(), candidate(), candidate()];
    const { container } = render(<PatternsSection data={data({ surfaced: many })} />);
    expect(container.querySelectorAll('li').length).toBe(3);
  });
});
