import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { addDaysIso } from '@/lib/dates';
import { LoadChart, MetricChart } from '@/modules/fitness/dashboard/charts';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
import { WeeklyTable } from '@/modules/fitness/dashboard/WeeklyTable';
import { getTrends } from '@/modules/fitness/engine/service';

export default async function TrendsPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect('/');

  const t = await getTrends(subject);
  const windowStart = addDaysIso(t.today, -27);

  const sleepValues = t.sleep.map((v) => v.value);
  const sleepMin = Math.max(0, Math.floor(Math.min(6, ...sleepValues)) - 1);
  const sleepMax = Math.ceil(Math.max(9, ...sleepValues)) + 1;

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-16">
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Tendencias</h1>
        <p className="text-sm text-zinc-500">últimos 28 días</p>
      </header>

      <TabNav active="trends" />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Carga y ACWR</h2>
        <LoadChart daily={t.daily} acute={t.acute7} chronic={t.chronic28} />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Sueño</h2>
          {t.sleepMean !== null ? (
            <span className="text-xs text-zinc-400">tu media: {t.sleepMean} h</span>
          ) : null}
        </div>
        <MetricChart
          points={t.sleep}
          windowStart={windowStart}
          today={t.today}
          yMin={sleepMin}
          yMax={sleepMax}
          mean={t.sleepMean}
          strokeClass="stroke-sky-600"
          label="Sueño últimos 28 días"
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Readiness</h2>
          {t.readinessMean !== null ? (
            <span className="text-xs text-zinc-400">tu media: {t.readinessMean}/5</span>
          ) : null}
        </div>
        <MetricChart
          points={t.readiness}
          windowStart={windowStart}
          today={t.today}
          yMin={1}
          yMax={5}
          mean={t.readinessMean}
          strokeClass="stroke-emerald-600"
          label="Readiness últimos 28 días"
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Resumen semanal</h2>
        <WeeklyTable weeks={t.weeks} />
      </section>
    </main>
  );
}
