'use client';

import { useState } from 'react';
import { createSubject } from './actions';

/** First-login onboarding: display name + auto-detected timezone (browser API → client). */
export function OnboardingForm() {
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  return (
    <form action={createSubject} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">¡Bienvenido!</h1>
        <p className="mt-1 text-sm text-zinc-500">¿Cómo te llamamos?</p>
      </div>
      <input
        name="display_name"
        type="text"
        required
        maxLength={50}
        placeholder="Tu nombre"
        className="w-full rounded-xl border border-zinc-300 bg-white p-3.5 outline-none focus:border-zinc-900"
      />
      <input type="hidden" name="timezone" value={timezone} />
      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 p-3.5 font-medium text-white active:scale-[0.99]"
      >
        Empezar
      </button>
      <p className="text-xs text-zinc-400">Zona horaria detectada: {timezone}</p>
    </form>
  );
}
