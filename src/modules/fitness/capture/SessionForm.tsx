'use client';

import { useState, useTransition } from 'react';
import { uuidv7 } from '@/lib/ids';
import type { ActionResult } from './actions';
import { saveSession } from './actions';
import { enqueueCapture } from './offline';
import type { Lift, Modality } from './schemas';
import { LIFTS, MODALITIES } from './schemas';

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

const LIFT_LABEL: Record<Lift, string> = {
  squat: 'Sentadilla',
  bench: 'Banca',
  deadlift: 'Peso muerto',
  ohp: 'Press militar',
  other: 'Otro',
};

type Props = { todayDate: string; yesterdayDate: string };

export function SessionForm({ todayDate, yesterdayDate }: Props) {
  const [formId, setFormId] = useState(() => uuidv7());
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const [modality, setModality] = useState<Modality | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [srpe, setSrpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [lift, setLift] = useState<Lift | null>(null);
  const [topWeight, setTopWeight] = useState<number | null>(null);
  const [topReps, setTopReps] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isMatch, setIsMatch] = useState(false);
  const [matchRating, setMatchRating] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const pickModality = (m: Modality) => {
    setModality(m);
    setDuration((d) => d ?? DEFAULT_DURATION[m]);
    // Outcome fields are modality-conditional (Zod superRefine) — switching
    // modality clears whatever no longer applies.
    setLift(null);
    setTopWeight(null);
    setTopReps(null);
    setDistance(null);
    setIsMatch(false);
    setMatchRating(null);
  };

  // Topset trio is all-or-nothing: picking a lift requires weight + reps too.
  const topsetComplete = lift === null || (topWeight !== null && topReps !== null);
  // A rugby match requires a rating; training doesn't.
  const matchComplete = !(modality === 'rugby' && isMatch) || matchRating !== null;

  const complete =
    modality !== null && duration !== null && srpe !== null && topsetComplete && matchComplete;

  const resetForNextEntry = () => {
    // Fresh idempotency id for the next entry.
    setFormId(uuidv7());
    setModality(null);
    setDuration(null);
    setSrpe(null);
    setNotes('');
    setLift(null);
    setTopWeight(null);
    setTopReps(null);
    setDistance(null);
    setIsMatch(false);
    setMatchRating(null);
  };

  const submit = () => {
    if (!complete) return;
    startTransition(async () => {
      const payload = {
        id: formId,
        date: day === 'today' ? todayDate : yesterdayDate,
        modality,
        duration_min: duration,
        srpe,
        notes: notes.length > 0 ? notes : undefined,
        lift: lift ?? undefined,
        top_set_weight_kg: topWeight ?? undefined,
        top_set_reps: topReps ?? undefined,
        distance_km: distance ?? undefined,
        is_match: isMatch,
        match_rating: matchRating ?? undefined,
      };
      const load = (duration ?? 0) * (srpe ?? 0);
      let result: ActionResult;
      try {
        result = await saveSession(payload);
      } catch {
        // Network down: queue locally (id travels with the payload, so the
        // replay upsert stays idempotent), replayed by <OfflineSync /> (D12).
        try {
          await enqueueCapture('session', payload);
          setMessage({
            kind: 'ok',
            text: `Sesión guardada offline ⏳ — carga ${load} AU, se sincroniza al reconectar`,
          });
          resetForNextEntry();
        } catch {
          setMessage({
            kind: 'error',
            text: 'Sin conexión y no se pudo guardar en el dispositivo.',
          });
        }
        return;
      }
      if (result.ok) {
        setMessage({ kind: 'ok', text: `Sesión guardada ✓ — carga ${load} AU` });
        resetForNextEntry();
      } else {
        setMessage({ kind: 'error', text: result.error });
      }
    });
  };

  return (
    <section className="rounded-xl border border-line bg-turf p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Nueva sesión
        </h2>
        <div className="flex gap-1 rounded-full border border-line bg-turf-2 p-1 text-sm">
          {(['today', 'yesterday'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`rounded-full px-3 py-1 font-medium ${
                day === d ? 'bg-chalk text-pitch' : 'text-dim'
              }`}
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
              className={`min-h-12 rounded-lg border font-display text-base font-semibold uppercase tracking-wide transition-colors ${
                modality === m
                  ? 'border-flood bg-flood text-pitch'
                  : 'border-line bg-turf-2 text-chalk active:bg-turf'
              }`}
            >
              {MODALITY_LABEL[m]}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-dim">Duración</span>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {duration !== null ? (
                <>
                  {duration} <span className="text-sm font-medium text-dim">min</span>
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDuration((d) => Math.max(5, (d ?? 60) - 5))}
              className="min-h-12 flex-1 rounded-lg border border-line bg-turf-2 font-medium text-chalk active:bg-turf"
            >
              −5 min
            </button>
            <button
              type="button"
              onClick={() => setDuration((d) => Math.min(600, (d ?? 55) + 5))}
              className="min-h-12 flex-1 rounded-lg border border-line bg-turf-2 font-medium text-chalk active:bg-turf"
            >
              +5 min
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-dim">Esfuerzo (sRPE)</span>
            <span className="text-sm text-flood">{srpe !== null ? RPE_ANCHORS[srpe] : ''}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSrpe(n)}
                className={`min-h-12 rounded-lg border font-display text-xl font-semibold tabular-nums transition-colors ${
                  srpe === n
                    ? 'border-flood bg-flood text-pitch'
                    : 'border-line bg-turf-2 text-chalk active:bg-turf'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {modality === 'gym' ? (
          <div className="space-y-3 rounded-lg border border-line bg-turf-2 p-3">
            <div>
              <span className="mb-1 block text-sm text-dim">Ejercicio (opcional)</span>
              <div className="grid grid-cols-3 gap-2">
                {LIFTS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLift((cur) => (cur === l ? null : l))}
                    className={`min-h-11 rounded-lg border text-sm font-medium transition-colors ${
                      lift === l
                        ? 'border-flood bg-flood text-pitch'
                        : 'border-line bg-turf text-chalk active:bg-turf-2'
                    }`}
                  >
                    {LIFT_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>
            {lift !== null ? (
              <>
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm text-dim">Peso serie tope</span>
                    <span className="font-display text-xl font-semibold tabular-nums">
                      {topWeight !== null ? `${topWeight} kg` : '—'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Stepper
                      onClick={() => setTopWeight((w) => Math.max(1, (w ?? 60) - 2.5))}
                      label="−2.5 kg"
                    />
                    <Stepper
                      onClick={() => setTopWeight((w) => Math.min(500, (w ?? 57.5) + 2.5))}
                      label="+2.5 kg"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm text-dim">Reps serie tope</span>
                    <span className="font-display text-xl font-semibold tabular-nums">
                      {topReps !== null ? topReps : '—'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Stepper
                      onClick={() => setTopReps((r) => Math.max(1, (r ?? 6) - 1))}
                      label="−1"
                    />
                    <Stepper
                      onClick={() => setTopReps((r) => Math.min(12, (r ?? 4) + 1))}
                      label="+1"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {modality === 'running' ? (
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm text-dim">Distancia (opcional)</span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {distance !== null ? (
                  <>
                    {distance.toFixed(1)} <span className="text-sm font-medium text-dim">km</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Stepper
                onClick={() =>
                  setDistance((d) => Number(Math.max(0.5, (d ?? 5.5) - 0.5).toFixed(1)))
                }
                label="−0.5 km"
              />
              <Stepper
                onClick={() =>
                  setDistance((d) => Number(Math.min(100, (d ?? 4.5) + 0.5).toFixed(1)))
                }
                label="+0.5 km"
              />
            </div>
          </div>
        ) : null}

        {modality === 'rugby' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['entrenamiento', 'partido'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    const nextIsMatch = kind === 'partido';
                    setIsMatch(nextIsMatch);
                    if (!nextIsMatch) setMatchRating(null);
                  }}
                  className={`min-h-11 flex-1 rounded-lg border font-medium capitalize transition-colors ${
                    isMatch === (kind === 'partido')
                      ? 'border-flood bg-flood text-pitch'
                      : 'border-line bg-turf-2 text-chalk active:bg-turf'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
            {isMatch ? (
              <div>
                <span className="mb-1 block text-sm text-dim">Autoevaluación del partido</span>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMatchRating(n)}
                      className={`min-h-12 rounded-lg border font-display text-xl font-semibold tabular-nums transition-colors ${
                        matchRating === n
                          ? 'border-flood bg-flood text-pitch'
                          : 'border-line bg-turf-2 text-chalk active:bg-turf'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Notas (opcional)"
          className="w-full rounded-lg border border-line bg-turf-2 p-3 text-sm text-chalk outline-none placeholder:text-faint focus:border-flood"
        />

        {message ? (
          <p className={`text-sm ${message.kind === 'ok' ? 'text-ok' : 'text-high'}`}>
            {message.text}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!complete || pending}
          onClick={submit}
          className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90 disabled:bg-turf-2 disabled:text-faint"
        >
          {pending ? 'Guardando…' : 'Guardar sesión'}
        </button>
      </div>
    </section>
  );
}

function Stepper({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 flex-1 rounded-lg border border-line bg-turf font-medium text-chalk active:bg-turf-2"
    >
      {label}
    </button>
  );
}
