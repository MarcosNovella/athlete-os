import { describe, expect, it } from 'vitest';
import { uuidv7 } from './ids';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('produces RFC 9562 v7 format (version + variant bits)', () => {
    for (let i = 0; i < 50; i++) {
      expect(uuidv7()).toMatch(UUID_RE);
    }
  });

  it('is unique across calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });

  it('sorts by generation time (timestamp prefix)', () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });
});
