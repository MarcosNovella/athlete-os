import { uuidv7 } from '@/lib/ids';
import type { CaptureKind } from '@/lib/offline/queue';
import { idbQueueStore } from '@/lib/offline/queue';

/** Fired whenever the queue changes so <OfflineSync /> can update/drain. */
export const QUEUE_CHANGED_EVENT = 'athleteos:queue-changed';

/**
 * Client-only (IndexedDB): stores a capture whose server action failed on the
 * network. The payload is replayed verbatim by <OfflineSync /> on reconnect.
 */
export async function enqueueCapture(kind: CaptureKind, payload: unknown): Promise<void> {
  await idbQueueStore().add({
    id: uuidv7(),
    kind,
    payload,
    queuedAt: new Date().toISOString(),
  });
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}
