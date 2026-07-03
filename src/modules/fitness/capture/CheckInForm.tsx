'use client';

import { useState, useTransition } from 'react';
import { PulseMark } from '@/core/ui/PulseMark';
import type { ActionResult } from './actions';
import { saveCheckIn } from './actions';
import { enqueueCapture } from './offline';

export type CheckInValues = {
  sleep_hours: number;
  sleep_quality: number;
  readiness: number;
  soreness: number;
  stress: number;
  bodyweight_kg: number | null;
  nutrition_adherence: number | null;
  alcohol: boolean;
  caffeine: boolean;
};

type Props = {
  todayDate: string;
  yesterdayDate: string;
  todayInitial: CheckInValues | null;
  yesterdayInitial: CheckInValues | null;
  /** D12: sleep stepper defaults to the last known value. */
  defaultSleepHours: number;
};

const SCALES: Array<{ key: keyof Omit<CheckInValues, 'sleep_hours'>; label: string }> = [
  { key: 'sleep_quality', label: 'Calidad de sueño' },
  { key: 'readiness', label: 'Energía / readiness' },
  { key: 'soreness', label: 'Dolor muscular' },
  { key: 'stress', label: 'Estrés' },
];

export function CheckInForm(props: Props) {
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const date = day === 'today' ? props.todayDate : props.yesterdayDate;
  const initial = day === 'today' ? props.todayInitial : props.yesterdayInitial;

  return (
    <section className="rounded-xl border border-line bg-turf p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Check-in
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
      <Fields
        key={date}
        date={date}
        initial={initial}
        defaultSleepHours={props.defaultSleepHours}
        backfill={day === 'yesterday'}
      />
    </section>
  );
}

function Fields({
  date,
  initial,
  defaultSleepHours,
  backfill,
}: {
  date: string;
  initial: CheckInValues | null;
  defaultSleepHours: number;
  backfill: boolean;
}) {
  const [sleepHours, setSleepHours] = useState(initial?.sleep_hours ?? defaultSleepHours);
  const [scales, setScales] = useState<Record<string, number | null>>({
    sleep_quality: initial?.sleep_quality ?? null,
    readiness: initial?.readiness ?? null,
    soreness: initial?.soreness ?? null,
    stress: initial?.stress ?? null,
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [bodyweight, setBodyweight] = useState<number | null>(initial?.bodyweight_kg ?? null);
  const [nutrition, setNutrition] = useState<number | null>(initial?.nutrition_adherence ?? null);
  const [alcohol, setAlcohol] = useState(initial?.alcohol ?? false);
  const [caffeine, setCaffeine] = useState(initial?.caffeine ?? false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'queued' | 'error'>(
    initial ? 'saved' : 'idle',
  );
  const [errorMsg, setErrorMsg] = useState('');
  // Only draw the reward pulse for a save made NOW, not for a pre-existing one.
  const [justSaved, setJustSaved] = useState(false);

  const complete = Object.values(scales).every((v) => v !== null);

  const submit = () => {
    startTransition(async () => {
      const payload = {
        date,
        sleep_hours: sleepHours,
        sleep_quality: scales.sleep_quality,
        readiness: scales.readiness,
        soreness: scales.soreness,
        stress: scales.stress,
        bodyweight_kg: bodyweight ?? undefined,
        nutrition_adherence: nutrition ?? undefined,
        alcohol,
        caffeine,
      };
      let result: ActionResult;
      try {
        result = await saveCheckIn(payload);
      } catch {
        // Network down: queue locally, replayed by <OfflineSync /> (D12).
        try {
          await enqueueCapture('checkin', payload);
          setStatus('queued');
        } catch {
          setStatus('error');
          setErrorMsg('Sin conexión y no se pudo guardar en el dispositivo.');
        }
        return;
      }
      if (result.ok) {
        setStatus('saved');
        setJustSaved(true);
      } else {
        setStatus('error');
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm text-dim">Horas de sueño</span>
          <span className="font-display text-2xl font-semibold tabular-nums">
            {sleepHours.toFixed(2)} <span className="text-sm font-medium text-dim">h</span>
          </span>
        </div>
        <div className="flex gap-2">
          <Stepper onClick={() => setSleepHours((h) => Math.max(0, h - 0.25))} label="−15 min" />
          <Stepper onClick={() => setSleepHours((h) => Math.min(24, h + 0.25))} label="+15 min" />
        </div>
      </div>

      {SCALES.map(({ key, label }) => (
        <div key={key}>
          <span className="mb-1 block text-sm text-dim">{label}</span>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScales((s) => ({ ...s, [key]: n }))}
                className={`min-h-12 rounded-lg border font-display text-xl font-semibold tabular-nums transition-colors ${
                  scales[key] === n
                    ? 'border-flood bg-flood text-pitch'
                    : 'border-line bg-turf-2 text-chalk active:bg-turf'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="w-full text-left text-sm text-dim underline-offset-2 hover:underline"
        >
          {moreOpen ? '− Menos datos' : '+ Más datos (opcional)'}
        </button>
        {moreOpen ? (
          <div className="mt-3 space-y-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-dim">Peso corporal</span>
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {bodyweight !== null ? (
                    <>
                      {bodyweight.toFixed(1)}{' '}
                      <span className="text-sm font-medium text-dim">kg</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <Stepper
                  onClick={() =>
                    setBodyweight((w) => Number(Math.max(30, (w ?? 80) - 0.1).toFixed(1)))
                  }
                  label="−0.1 kg"
                />
                <Stepper
                  onClick={() =>
                    setBodyweight((w) => Number(Math.min(250, (w ?? 79.9) + 0.1).toFixed(1)))
                  }
                  label="+0.1 kg"
                />
              </div>
            </div>

            <div>
              <span className="mb-1 block text-sm text-dim">¿Comiste acorde?</span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNutrition((cur) => (cur === n ? null : n))}
                    className={`min-h-12 rounded-lg border font-display text-xl font-semibold tabular-nums transition-colors ${
                      nutrition === n
                        ? 'border-flood bg-flood text-pitch'
                        : 'border-line bg-turf-2 text-chalk active:bg-turf'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Toggle label="Alcohol" checked={alcohol} onChange={setAlcohol} />
              <Toggle label="Cafeína" checked={caffeine} onChange={setCaffeine} />
            </div>
          </div>
        ) : null}
      </div>

      {backfill ? (
        <p className="text-xs text-faint">
          Registrando <span className="font-medium text-dim">ayer</span> — se marca como backfill.
        </p>
      ) : null}
      {status === 'error' ? <p className="text-sm text-high">{errorMsg}</p> : null}

      <button
        type="button"
        disabled={!complete || pending}
        onClick={submit}
        className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90 disabled:bg-turf-2 disabled:text-faint"
      >
        {pending ? 'Guardando…' : status === 'saved' ? 'Actualizar ✓' : 'Guardar check-in'}
      </button>
      {status === 'saved' && !pending ? (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-ok">
          {justSaved ? <PulseMark className="h-3.5 w-6 shrink-0" animate /> : null}
          Guardado ✓ — readiness {scales.readiness}/5, {sleepHours.toFixed(2)} h de sueño
        </p>
      ) : null}
      {status === 'queued' && !pending ? (
        <p className="text-center text-sm text-flood">
          Sin conexión — guardado en este dispositivo ⏳ se sincroniza solo al reconectar.
        </p>
      ) : null}
    </div>
  );
}

function Stepper({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-12 flex-1 rounded-lg border border-line bg-turf-2 font-medium text-chalk active:bg-turf"
    >
      {label}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`min-h-12 flex-1 rounded-lg border font-medium transition-colors ${
        checked
          ? 'border-flood bg-flood text-pitch'
          : 'border-line bg-turf-2 text-chalk active:bg-turf'
      }`}
    >
      {label}
    </button>
  );
}
