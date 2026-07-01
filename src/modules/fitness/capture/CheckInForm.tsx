'use client';

import { useState, useTransition } from 'react';
import { saveCheckIn } from './actions';

type CheckInValues = {
  sleep_hours: number;
  sleep_quality: number;
  readiness: number;
  soreness: number;
  stress: number;
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
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Check-in</h2>
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
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>(initial ? 'saved' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');

  const complete = Object.values(scales).every((v) => v !== null);

  const submit = () => {
    startTransition(async () => {
      const result = await saveCheckIn({
        date,
        sleep_hours: sleepHours,
        sleep_quality: scales.sleep_quality,
        readiness: scales.readiness,
        soreness: scales.soreness,
        stress: scales.stress,
      });
      if (result.ok) {
        setStatus('saved');
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
          <span className="text-sm text-zinc-600">Horas de sueño</span>
          <span className="text-lg font-semibold tabular-nums">{sleepHours.toFixed(2)} h</span>
        </div>
        <div className="flex gap-2">
          <Stepper onClick={() => setSleepHours((h) => Math.max(0, h - 0.25))} label="−15 min" />
          <Stepper onClick={() => setSleepHours((h) => Math.min(24, h + 0.25))} label="+15 min" />
        </div>
      </div>

      {SCALES.map(({ key, label }) => (
        <div key={key}>
          <span className="mb-1 block text-sm text-zinc-600">{label}</span>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScales((s) => ({ ...s, [key]: n }))}
                className={`min-h-12 rounded-xl border text-lg font-medium tabular-nums transition-colors ${
                  scales[key] === n
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 active:bg-zinc-100'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      {backfill ? (
        <p className="text-xs text-zinc-500">
          Registrando <span className="font-medium">ayer</span> — se marca como backfill.
        </p>
      ) : null}
      {status === 'error' ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

      <button
        type="button"
        disabled={!complete || pending}
        onClick={submit}
        className="w-full rounded-xl bg-zinc-900 p-3.5 font-medium text-white disabled:bg-zinc-300"
      >
        {pending ? 'Guardando…' : status === 'saved' ? 'Actualizar ✓' : 'Guardar check-in'}
      </button>
      {status === 'saved' && !pending ? (
        <p className="text-center text-sm text-emerald-700">
          Guardado ✓ — readiness {scales.readiness}/5, {sleepHours.toFixed(2)} h de sueño
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
      className="min-h-12 flex-1 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 active:bg-zinc-100"
    >
      {label}
    </button>
  );
}
