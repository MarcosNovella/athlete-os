import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './service';

/** Simulates a PostgREST-style source: inclusive from..to range over `total` rows. */
function rangeSource(total: number) {
  return async (from: number, to: number): Promise<number[]> => {
    const rows: number[] = [];
    for (let i = from; i <= to && i < total; i++) rows.push(i);
    return rows;
  };
}

describe('fetchAllPages', () => {
  it('returns a single short page in one request', async () => {
    const fetchPage = vi.fn(rangeSource(450));
    const rows = await fetchAllPages(fetchPage, 1000);
    expect(rows).toHaveLength(450);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, 999);
  });

  it('drains past the page cap without dropping or duplicating rows', async () => {
    const rows = await fetchAllPages(rangeSource(2350), 1000);
    expect(rows).toHaveLength(2350);
    expect(rows[0]).toBe(0);
    expect(rows.at(-1)).toBe(2349);
    expect(new Set(rows).size).toBe(2350);
  });

  it('handles a total that is an exact multiple of the page size', async () => {
    const fetchPage = vi.fn(rangeSource(2000));
    const rows = await fetchAllPages(fetchPage, 1000);
    expect(rows).toHaveLength(2000);
    // Full second page cannot prove exhaustion; a third (empty) request confirms it.
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenLastCalledWith(2000, 2999);
  });

  it('returns empty for an empty source', async () => {
    await expect(fetchAllPages(rangeSource(0), 1000)).resolves.toEqual([]);
  });

  it('propagates page errors instead of returning partial data', async () => {
    const failing = async (from: number): Promise<number[]> => {
      if (from > 0) throw new Error('boom');
      return Array.from({ length: 1000 }, (_, i) => i);
    };
    await expect(fetchAllPages(failing, 1000)).rejects.toThrow('boom');
  });
});
