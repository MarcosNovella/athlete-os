import { describe, expect, it } from 'vitest';
import { appHealth } from './health';

describe('appHealth', () => {
  it('reports ok', () => {
    expect(appHealth().ok).toBe(true);
  });
});
