import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { addDaysIso } from '@/lib/dates';
import { AcwrChart, LoadChart, MetricChart } from '@/modules/fitness/dashboard/charts';
import { InfoTip } from '@/modules/fitness/dashboard/InfoTip';
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
        <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
          Tendencias
        </h1>
        <p className="mt-1 font-mono text-[10px] text-faint">últimos 28 días</p>
      </header>

      <TabNav active="trends" />

      <section className="rounded-xl border border-line bg-turf p-4">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Carga
        </h2>
        <LoadChart daily={t.daily} acute={t.acute7} chronic={t.chronic28} />
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          <span>ACWR</span>
          <InfoTip term="acwr" id="trends" />
        </h2>
        {t.acwr.length > 0 ? (
          <AcwrChart points={t.acwr} windowStart={windowStart} today={t.today} />
        ) : (
          <p className="text-sm text-faint">Se desbloquea con 14 días de historia.</p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            Sueño
          </h2>
          {t.sleepMean !== null ? (
            <span className="font-mono text-[10px] text-faint">tu media: {t.sleepMean} h</span>
          ) : null}
        </div>
        <MetricChart
          points={t.sleep}
          windowStart={windowStart}
          today={t.today}
          yMin={sleepMin}
          yMax={sleepMax}
          mean={t.sleepMean}
          strokeClass="stroke-sleep"
          label="Sueño últimos 28 días"
        />
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            Readiness
          </h2>
          {t.readinessMean !== null ? (
            <span className="font-mono text-[10px] text-faint">tu media: {t.readinessMean}/5</span>
          ) : null}
        </div>
        <MetricChart
          points={t.readiness}
          windowStart={windowStart}
          today={t.today}
          yMin={1}
          yMax={5}
          mean={t.readinessMean}
          strokeClass="stroke-ok"
          label="Readiness últimos 28 días"
        />
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          Resumen semanal
        </h2>
        <WeeklyTable weeks={t.weeks} />
      </section>
    </main>
  );
}
