import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@/lib/ids';
import type { QueuedCapture, QueueStore } from './queue';
import type { Senders, SendResult } from './sync';
import { drainQueue } from './sync';

function memoryStore(initial: QueuedCapture[]): QueueStore & { items: QueuedCapture[] } {
  const items = [...initial];
  return {
    items,
    add: async (item) => {
      items.push(item);
    },
    all: async () => [...items],
    remove: async (id) => {
      const index = items.findIndex((i) => i.id === id);
      if (index >= 0) items.splice(index, 1);
    },
  };
}

function queued(kind: QueuedCapture['kind'], payload: unknown, atMs: number): QueuedCapture {
  return { id: uuidv7(atMs), kind, payload, queuedAt: new Date(atMs).toISOString() };
}

function senders(
  impl: (item: { kind: string; payload: unknown }) => Promise<SendResult>,
): Senders & { calls: Array<{ kind: string; payload: unknown }> } {
  const calls: Array<{ kind: string; payload: unknown }> = [];
  const make = (kind: string) => (payload: unknown) => {
    calls.push({ kind, payload });
    return impl({ kind, payload });
  };
  return { calls, checkin: make('checkin'), session: make('session') };
}

describe('drainQueue', () => {
  it('replays in capture (FIFO) order and removes sent items', async () => {
    const store = memoryStore([
      queued('session', { n: 2 }, 2_000),
      queued('checkin', { n: 1 }, 1_000),
      queued('session', { n: 3 }, 3_000),
    ]);
    const send = senders(async () => ({ ok: true }));

    const report = await drainQueue(store, send);

    expect(report).toEqual({ sent: 3, dropped: [], kept: 0 });
    expect(send.calls.map((c) => (c.payload as { n: number }).n)).toEqual([1, 2, 3]);
    expect(store.items).toHaveLength(0);
  });

  it('drops server-rejected items but keeps replaying the rest', async () => {
    const store = memoryStore([
      queued('checkin', { n: 1 }, 1_000),
      queued('session', { n: 2 }, 2_000),
    ]);
    const send = senders(async ({ kind }) =>
      kind === 'checkin' ? { ok: false, error: 'ventana vencida' } : { ok: true },
    );

    const report = await drainQueue(store, send);

    expect(report.sent).toBe(1);
    expect(report.kept).toBe(0);
    expect(report.dropped).toHaveLength(1);
    expect(report.dropped[0]?.error).toBe('ventana vencida');
    expect(store.items).toHaveLength(0); // rejected items never retry forever
  });

  it('keeps everything from the first network failure on (still offline)', async () => {
    const store = memoryStore([
      queued('checkin', { n: 1 }, 1_000),
      queued('session', { n: 2 }, 2_000),
      queued('session', { n: 3 }, 3_000),
    ]);
    let calls = 0;
    const send = senders(async () => {
      calls += 1;
      if (calls >= 2) throw new TypeError('Failed to fetch');
      return { ok: true };
    });

    const report = await drainQueue(store, send);

    expect(report).toEqual({ sent: 1, dropped: [], kept: 2 });
    expect(store.items.map((i) => (i.payload as { n: number }).n)).toEqual([2, 3]);
  });

  it('is a no-op on an empty queue', async () => {
    const store = memoryStore([]);
    const send = senders(async () => ({ ok: true }));

    expect(await drainQueue(store, send)).toEqual({ sent: 0, dropped: [], kept: 0 });
    expect(send.calls).toHaveLength(0);
  });
});
