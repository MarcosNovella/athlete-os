import { PulseMark } from '@/core/ui/PulseMark';

/**
 * Offline fallback shell, precached by sw.js at install. Auth-exempt in
 * proxy.ts: it renders no subject data, only a static explainer.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <PulseMark className="h-5 w-9 text-faint" />
      <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
        Sin conexión
      </h1>
      <p className="text-sm text-dim">
        No hay internet y esta pantalla todavía no está en caché. Tus registros guardados offline no
        se pierden: se sincronizan solos cuando vuelva la conexión.
      </p>
      <a
        href="/"
        className="mt-2 rounded-lg bg-flood px-4 py-2.5 font-semibold text-pitch active:brightness-90"
      >
        Reintentar
      </a>
    </main>
  );
}
