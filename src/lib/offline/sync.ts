import type { CaptureKind, QueuedCapture, QueueStore } from './queue';

/** Mirrors the capture actions' ActionResult; senders are the server actions. */
export type SendResult = { ok: true } | { ok: false; error: string };
export type Senders = Record<CaptureKind, (payload: unknown) => Promise<SendResult>>;

export type DrainReport = {
  /** Replayed and accepted by the server. */
  sent: number;
  /** Rejected by the server (e.g. backfill window expired): removed, surfaced to the user. */
  dropped: Array<{ item: QueuedCapture; error: string }>;
  /** Still queued: the network failed again mid-drain. */
  kept: number;
};

/**
 * Replays queued captures in FIFO order (uuidv7 ids sort by capture time).
 * - sender resolves ok:true  → remove (synced)
 * - sender resolves ok:false → remove BUT report (terminal server rejection;
 *   retrying would reject forever — last-write-wins semantics per D12)
 * - sender throws            → still offline: keep this and the rest, stop.
 */
export async function drainQueue(store: QueueStore, senders: Senders): Promise<DrainReport> {
  const items = [...(await store.all())].sort((a, b) => (a.id < b.id ? -1 : 1));

  let sent = 0;
  const dropped: DrainReport['dropped'] = [];

  for (const [index, item] of items.entries()) {
    let result: SendResult;
    try {
      result = await senders[item.kind](item.payload);
    } catch {
      return { sent, dropped, kept: items.length - index };
    }
    if (result.ok) sent += 1;
    else dropped.push({ item, error: result.error });
    await store.remove(item.id);
  }
  return { sent, dropped, kept: 0 };
}
