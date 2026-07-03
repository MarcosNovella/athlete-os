import { logout } from '@/core/auth/actions';
import { OnboardingForm } from '@/core/subjects/OnboardingForm';
import { getCurrentSubject } from '@/core/subjects/service';
import { PulseMark } from '@/core/ui/PulseMark';
import { addDaysIso, localDateInTz } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { CheckInForm } from '@/modules/fitness/capture/CheckInForm';
import { OfflineSync } from '@/modules/fitness/capture/OfflineSync';
import { SessionForm } from '@/modules/fitness/capture/SessionForm';
import { InfoTip } from '@/modules/fitness/dashboard/InfoTip';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
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
      <header className="pt-2">
        <div className="flex items-center gap-2">
          <PulseMark className="h-4 w-7 text-flood" />
          <span className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-dim">
            Athlete OS
          </span>
          <span className="ml-auto font-mono text-[10px] text-faint">{today}</span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
            Hola, {subject.display_name}
          </h1>
          <form action={logout}>
            <button type="submit" className="text-sm text-faint underline-offset-2 hover:underline">
              Salir
            </button>
          </form>
        </div>
      </header>

      <TabNav active="today" />

      <OfflineSync />

      <TodayStatePanel snapshot={snapshot} />

      <CheckInForm
        todayDate={today}
        yesterdayDate={yesterday}
        todayInitial={todayCheckin.data}
        yesterdayInitial={yesterdayCheckin.data}
        defaultSleepHours={yesterdayCheckin.data?.sleep_hours ?? 8}
      />

      <SessionForm todayDate={today} yesterdayDate={yesterday} />

      <section className="rounded-xl border border-line bg-turf p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            <span>Sesiones de hoy</span>
            <InfoTip term="srpe" />
          </h2>
          <span className="text-sm text-dim">
            carga total:{' '}
            <span className="font-display text-base font-semibold tabular-nums text-chalk">
              {dailyLoad} AU
            </span>
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-faint">Todavía no registraste sesiones hoy.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-medium capitalize">{s.modality}</span>
                  <span className="ml-2 font-mono text-xs text-dim">
                    {s.duration_min} min · RPE {s.srpe}
                  </span>
                  {s.notes ? <p className="text-xs text-faint">{s.notes}</p> : null}
                </div>
                <span className="font-display text-lg font-semibold tabular-nums">
                  {s.load ?? 0} <span className="text-xs font-medium text-dim">AU</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
