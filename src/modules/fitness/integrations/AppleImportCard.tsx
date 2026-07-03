'use client';

import { useRef, useState, useTransition } from 'react';
import type { UploadResult } from './actions';
import { uploadAppleExport } from './actions';

type LatestBatch = {
  file_name: string | null;
  observation_count: number;
  date_min: string | null;
  date_max: string | null;
  created_at: string;
} | null;

export function AppleImportCard({ latestBatch }: { latestBatch: LatestBatch }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UploadResult | null>(null);

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await uploadAppleExport(formData);
      setResult(res);
      if (res.ok) formRef.current?.reset();
    });
  };

  return (
    <section className="rounded-xl border border-line bg-turf p-4">
      <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
        Apple Watch / Salud
      </h2>

      {latestBatch ? (
        <p className="mb-3 text-sm text-faint">
          Última carga: {latestBatch.observation_count} registros
          {latestBatch.date_min && latestBatch.date_max
            ? ` (${latestBatch.date_min} → ${latestBatch.date_max})`
            : ''}
          {' · '}
          {new Date(latestBatch.created_at).toLocaleString('es-AR')}
        </p>
      ) : (
        <p className="mb-3 text-sm text-faint">Todavía no subiste ningún export.</p>
      )}

      <ol className="mb-3 list-decimal space-y-1 pl-4 text-xs text-faint">
        <li>Abrí la app Health Auto Export en tu iPhone.</li>
        <li>Exportá VFC, FC en reposo y sueño como JSON.</li>
        <li>Subí el archivo acá abajo.</li>
      </ol>

      <form ref={formRef} action={submit} className="space-y-3">
        <input
          type="file"
          name="file"
          accept="application/json,.json"
          required
          className="w-full rounded-lg border border-line bg-turf-2 p-2.5 text-sm text-chalk file:mr-3 file:rounded-md file:border-0 file:bg-flood file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-pitch"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90 disabled:bg-turf-2 disabled:text-faint"
        >
          {pending ? 'Subiendo…' : 'Subir export'}
        </button>
      </form>

      {result ? (
        <p className={`mt-3 text-sm ${result.ok ? 'text-ok' : 'text-high'}`}>
          {result.ok
            ? `Guardado ✓ — ${result.observationCount} registros${
                result.skippedCount > 0 ? `, ${result.skippedCount} filas omitidas` : ''
              }.`
            : result.error}
        </p>
      ) : null}
    </section>
  );
}
