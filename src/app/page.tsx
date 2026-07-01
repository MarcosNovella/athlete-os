import { logout } from '@/core/auth/actions';
import { OnboardingForm } from '@/core/subjects/OnboardingForm';
import { getCurrentSubject } from '@/core/subjects/service';
import { addDaysIso, localDateInTz } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { CheckInForm } from '@/modules/fitness/capture/CheckInForm';
import { SessionForm } from '@/modules/fitness/capture/SessionForm';
import { TodayStatePanel } from '@/modules/fitness/dashboard/TodayStatePanel';
import { getEngineSnapshot } from '@/modules/fitness/engine/service';

export default async function TodayPage() {
  const subject = await getCurrentSubject();

  if (!subject) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <OnboardingForm />
      </main>
    );
  }

  const today = localDateInTz(subject.timezone);
  const yesterday = addDaysIso(today, -1);
  const supabase = await createClient();

  const [snapshot, todayCheckin, yesterdayCheckin, todaySessions] = await Promise.all([
    getEngineSnapshot(subject),
    supabase
      .from('daily_checkins')
      .select('sleep_hours, sleep_quality, readiness, soreness, stress')
      .eq('subject_id', subject.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('daily_checkins')
      .select('sleep_hours, sleep_quality, readiness, soreness, stress')
      .eq('subject_id', subject.id)
      .eq('date', yesterday)
      .maybeSingle(),
    supabase
      .from('training_sessions')
      .select('id, modality, duration_min, srpe, load, notes')
      .eq('subject_id', subject.id)
      .eq('date', today)
      .order('started_at', { ascending: true }),
  ]);

  const sessions = todaySessions.data ?? [];
  const dailyLoad = sessions.reduce((sum, s) => sum + (s.load ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hola, {subject.display_name}</h1>
          <p className="text-sm text-zinc-500">{today}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-400 underline-offset-2 hover:underline"
          >
            Salir
          </button>
        </form>
      </header>

      <TodayStatePanel snapshot={snapshot} />

      <CheckInForm
        todayDate={today}
        yesterdayDate={yesterday}
        todayInitial={todayCheckin.data}
        yesterdayInitial={yesterdayCheckin.data}
        defaultSleepHours={yesterdayCheckin.data?.sleep_hours ?? 8}
      />

      <SessionForm todayDate={today} yesterdayDate={yesterday} />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Sesiones de hoy</h2>
          <span className="text-sm text-zinc-500">
            carga total: <span className="font-semibold tabular-nums">{dailyLoad} AU</span>
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-400">Todavía no registraste sesiones hoy.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-medium capitalize">{s.modality}</span>
                  <span className="ml-2 text-sm text-zinc-500">
                    {s.duration_min} min · RPE {s.srpe}
                  </span>
                  {s.notes ? <p className="text-xs text-zinc-400">{s.notes}</p> : null}
                </div>
                <span className="font-semibold tabular-nums">{s.load ?? 0} AU</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
