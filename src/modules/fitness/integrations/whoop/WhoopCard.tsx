'use client';

import { useState, useTransition } from 'react';
import { connectWhoop, disconnectWhoop, syncWhoopNow } from './actions';

export type WhoopCardConnection = {
  status: 'connected' | 'reauth_required';
  last_synced_at: string | null;
  last_sync_status: string | null;
} | null;

export function WhoopCard({
  enabled,
  connection,
}: {
  enabled: boolean;
  connection: WhoopCardConnection;
}) {
  const [pending, startTransition] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const runSync = () => {
    startTransition(async () => {
      const result = await syncWhoopNow();
      setSyncMsg(
        result.ok ? `Sincronizado ✓ (${result.observationCount} registros nuevos)` : result.error,
      );
    });
  };

  return (
    <section className="rounded-xl border border-line bg-turf p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Whoop
        </h2>
        {!enabled ? (
          <span className="rounded-full bg-turf-2 px-2 py-0.5 text-xs font-medium text-faint">
            Próximamente
          </span>
        ) : null}
      </div>

      {!enabled ? (
        <p className="text-sm text-faint">
          Todavía no configurado. Se habilita cuando lleguen los relojes Whoop.
        </p>
      ) : !connection ? (
        <form action={connectWhoop}>
          <button
            type="submit"
            className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90"
          >
            Conectar Whoop
          </button>
        </form>
      ) : connection.status === 'reauth_required' ? (
        <div className="space-y-3">
          <p className="text-sm text-high">
            La conexión expiró. Reconectá para seguir sincronizando.
          </p>
          <form action={connectWhoop}>
            <button
              type="submit"
              className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90"
            >
              Reconectar
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-faint">
            {connection.last_synced_at
              ? `Última sincronización: ${new Date(connection.last_synced_at).toLocaleString('es-AR')}`
              : 'Todavía no sincronizó.'}
            {connection.last_sync_status ? ` · ${connection.last_sync_status}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={runSync}
              className="flex-1 rounded-lg bg-flood p-3 text-sm font-semibold text-pitch active:brightness-90 disabled:bg-turf-2 disabled:text-faint"
            >
              {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <form
              action={disconnectWhoop}
              className="flex-1"
              onSubmit={(e) => {
                if (!confirm('¿Desconectar Whoop? Tus datos ya guardados no se borran.')) {
                  e.preventDefault();
                }
              }}
            >
              <button
                type="submit"
                className="w-full rounded-lg border border-line bg-turf-2 p-3 text-sm font-medium text-dim"
              >
                Desconectar
              </button>
            </form>
          </div>
          {syncMsg ? <p className="text-sm text-faint">{syncMsg}</p> : null}
        </div>
      )}
    </section>
  );
}
