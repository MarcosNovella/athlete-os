'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { idbQueueStore } from '@/lib/offline/queue';
import { drainQueue } from '@/lib/offline/sync';
import { saveCheckIn, saveSession } from './actions';
import { QUEUE_CHANGED_EVENT } from './offline';

/**
 * Offline sync manager + status badge (D12). Invisible while the queue is
 * empty; otherwise shows the pending count and replays on reconnect/mount.
 */
export function OfflineSync() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [dropped, setDropped] = useState<string[]>([]);
  const draining = useRef(false);

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    setSyncing(true);
    try {
      const store = idbQueueStore();
      if ((await store.all()).length === 0) return;
      const report = await drainQueue(store, { checkin: saveCheckIn, session: saveSession });
      setPending(report.kept);
      if (report.dropped.length > 0) {
        setDropped((prev) => [...prev, ...report.dropped.map((d) => d.error)]);
      }
      if (report.sent > 0) router.refresh();
    } finally {
      draining.current = false;
      setSyncing(false);
    }
  }, [router]);

  useEffect(() => {
    const updateCount = () => {
      idbQueueStore()
        .all()
        .then((items) => setPending(items.length))
        .catch(() => {});
    };
    const onQueueChanged = () => {
      updateCount();
      if (navigator.onLine) void drain();
    };
    const onOnline = () => void drain();

    updateCount();
    if (navigator.onLine) void drain();

    window.addEventListener('online', onOnline);
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    };
  }, [drain]);

  if (pending === 0 && dropped.length === 0) return null;

  return (
    <div className="space-y-2">
      {pending > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            {pending === 1 ? '1 registro esperando' : `${pending} registros esperando`} conexión —
            se sincronizan solos.
          </span>
          <button
            type="button"
            onClick={() => void drain()}
            disabled={syncing}
            className="ml-3 shrink-0 rounded-full bg-amber-900 px-3 py-1 font-medium text-amber-50 disabled:opacity-50"
          >
            {syncing ? 'Sincronizando…' : 'Reintentar'}
          </button>
        </div>
      ) : null}
      {dropped.map((error) => (
        <div
          key={error}
          className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          <span>Un registro offline no se pudo sincronizar: {error}</span>
          <button
            type="button"
            onClick={() => setDropped((prev) => prev.filter((e) => e !== error))}
            className="ml-3 shrink-0 font-medium underline underline-offset-2"
          >
            OK
          </button>
        </div>
      ))}
    </div>
  );
}
