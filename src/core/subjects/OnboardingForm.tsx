'use client';

import { useState } from 'react';
import { createSubject } from './actions';

/** First-login onboarding: display name + auto-detected timezone (browser API → client). */
export function OnboardingForm() {
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  return (
    <form action={createSubject} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
          ¡Bienvenido!
        </h1>
        <p className="mt-1 text-sm text-dim">¿Cómo te llamamos?</p>
      </div>
      <input
        name="display_name"
        type="text"
        required
        maxLength={50}
        placeholder="Tu nombre"
        className="w-full rounded-lg border border-line bg-turf-2 p-3.5 text-chalk outline-none placeholder:text-faint focus:border-flood"
      />
      <input type="hidden" name="timezone" value={timezone} />
      <button
        type="submit"
        className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:scale-[0.99]"
      >
        Empezar
      </button>
      <p className="font-mono text-[10px] text-faint">Zona horaria detectada: {timezone}</p>
    </form>
  );
}
