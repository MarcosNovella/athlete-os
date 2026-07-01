'use client';

import { useState, useTransition } from 'react';
import { uuidv7 } from '@/lib/ids';
import { saveSession } from './actions';
import type { Modality } from './schemas';
import { MODALITIES } from './schemas';

/** Foster verbal anchors for sRPE (shown for the selected value). */
const RPE_ANCHORS: Record<number, string> = {
  1: 'Muy, muy fácil',
  2: 'Fácil',
  3: 'Moderado',
  4: 'Algo duro',
  5: 'Duro',
  6: 'Duro',
  7: 'Muy duro',
  8: 'Muy duro',
  9: 'Casi máximo',
  10: 'Máximo',
};

const MODALITY_LABEL: Record<Modality, string> = {
  rugby: 'Rugby',
  gym: 'Gym',
  running: 'Running',
};

/** D12: per-modality duration defaults. */
const DEFAULT_DURATION: Record<Modality, number> = { rugby: 80, gym: 60, running: 45 };

type Props = { todayDate: string; yesterdayDate: string };

export function SessionForm({ todayDate, yesterdayDate }: Props) {
  const [formId, setFormId] = useState(() => uuidv7());
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const [modality, setModality] = useState<Modality | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [srpe, setSrpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const pickModality = (m: Modality) => {
    setModality(m);
    setDuration((d) => d ?? DEFAULT_DURATION[m]);
  };

  const complete = modality !== null && duration !== null && srpe !== null;

  const submit = () => {
    if (!complete) return;
    startTransition(async () => {
      const result = await saveSession({
        id: formId,
        date: day === 'today' ? todayDate : yesterdayDate,
        modality,
        duration_min: duration,
        srpe,
        notes: notes.length > 0 ? notes : undefined,
      });
      if (result.ok) {
        const load = (duration ?? 0) * (srpe ?? 0);
        setMessage({ kind: 'ok', text: `Sesión guardada ✓ — carga ${load} AU` });
        // Reset for the next entry with a fresh idempotency id.
        setFormId(uuidv7());
        setModality(null);
        setDuration(null);
        setSrpe(null);
        setNotes('');
      } else {
        setMessage({ kind: 'error', text: result.error });
      }
    });
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Nueva sesión</h2>
        <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-sm">
          {(['today', 'yesterday'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`rounded-full px-3 py-1 ${day === d ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}
            >
              {d === 'today' ? 'Hoy' : 'Ayer'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {MODALITIES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pickModality(m)}
              className={`min-h-12 rounded-xl border font-medium transition-colors ${
                modality === m
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 active:bg-zinc-100'
              }`}
            >
              {MODALITY_LABEL[m]}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-zinc-600">Duración</span>
            <span className="text-lg font-semibold tabular-nums">
              {duration !== null ? `${duration} min` : '—'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDuration((d) => Math.max(5, (d ?? 60) - 5))}
              className="min-h-12 flex-1 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 active:bg-zinc-100"
            >
              −5 min
            </button>
            <button
              type="button"
              onClick={() => setDuration((d) => Math.min(600, (d ?? 55) + 5))}
              className="min-h-12 flex-1 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 active:bg-zinc-100"
            >
              +5 min
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-zinc-600">Esfuerzo (sRPE)</span>
            <span className="text-sm text-zinc-500">{srpe !== null ? RPE_ANCHORS[srpe] : ''}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSrpe(n)}
                className={`min-h-12 rounded-xl border text-lg font-medium tabular-nums transition-colors ${
                  srpe === n
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 active:bg-zinc-100'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Notas (opcional)"
          className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-zinc-900"
        />

        {message ? (
          <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
            {message.text}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!complete || pending}
          onClick={submit}
          className="w-full rounded-xl bg-zinc-900 p-3.5 font-medium text-white disabled:bg-zinc-300"
        >
          {pending ? 'Guardando…' : 'Guardar sesión'}
        </button>
      </div>
    </section>
  );
}
