/**
 * Offline fallback shell, precached by sw.js at install. Auth-exempt in
 * proxy.ts: it renders no subject data, only a static explainer.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Sin conexión</h1>
      <p className="text-sm text-zinc-500">
        No hay internet y esta pantalla todavía no está en caché. Tus registros guardados offline no
        se pierden: se sincronizan solos cuando vuelva la conexión.
      </p>
      <a
        href="/"
        className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 font-medium text-white active:bg-zinc-700"
      >
        Reintentar
      </a>
    </main>
  );
}
