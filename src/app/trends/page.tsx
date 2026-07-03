import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { addDaysIso } from '@/lib/dates';
import { formatPace } from '@/modules/fitness/capture/emission';
import { AcwrChart, LoadChart, MetricChart } from '@/modules/fitness/dashboard/charts';
import { InfoTip } from '@/modules/fitness/dashboard/InfoTip';
import { SignalsCue } from '@/modules/fitness/dashboard/SignalsCue';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
import { WeeklyTable } from '@/modules/fitness/dashboard/WeeklyTable';
import { getEngineSnapshot, getTrends } from '@/modules/fitness/engine/service';
import { signalSummary } from '@/modules/fitness/engine/snapshot';

const LIFT_LABEL = {
  squat: 'Sentadilla',
  bench: 'Banca',
  deadlift: 'Peso muerto',
  ohp: 'Press militar',
} as const;

export default async function TrendsPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect('/');

  // Same per-request observation fetch under both (React cache in service.ts).
  const [t, snapshot] = await Promise.all([getTrends(subject), getEngineSnapshot(subject)]);
  const windowStart = addDaysIso(t.today, -27);

  const sleepValues = t.sleep.map((v) => v.value);
  const sleepMin = Math.max(0, Math.floor(Math.min(6, ...sleepValues)) - 1);
  const sleepMax = Math.ceil(Math.max(9, ...sleepValues)) + 1;

  const windowStart90 = addDaysIso(t.today, -89);
  const { outcomes, recovery } = t;
  const bodyweightValues = outcomes.bodyweight.points.map((p) => p.value);
  const lifts = (['squat', 'bench', 'deadlift', 'ohp'] as const).filter(
    (l) => outcomes.e1rm[l].points.length >= 2,
  );
  const recoveryHasAnyData =
    recovery.recoveryScore.points.length > 0 ||
    recovery.hrvRmssd.points.length > 0 ||
    recovery.hrvSdnn.points.length > 0 ||
    recovery.restingHr.points.length > 0 ||
    recovery.sleepDevice.points.length > 0;

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-16">
      <header className="pt-2">
        <div className="flex items-end justify-between">
          <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
            Tendencias
          </h1>
          <SignalsCue summary={signalSummary(snapshot.flags)} linkToToday />
        </div>
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
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          <span>Recuperación</span>
          <InfoTip term="recovery" id="trends" />
        </h2>
        {recoveryHasAnyData ? (
          <div className="space-y-4">
            {recovery.recoveryScore.points.length > 0 ? (
              <div>
                <span className="mb-1 block text-xs text-dim">Recovery (Whoop)</span>
                <MetricChart
                  points={recovery.recoveryScore.points}
                  windowStart={windowStart}
                  today={t.today}
                  yMin={0}
                  yMax={100}
                  mean={recovery.recoveryScore.mean}
                  strokeClass="stroke-ok"
                  label="Recovery últimos 28 días"
                  connectGaps
                />
              </div>
            ) : null}
            {recovery.hrvRmssd.points.length > 0 ? (
              <div>
                <span className="mb-1 flex items-center gap-1.5 text-xs text-dim">
                  VFC (RMSSD, Whoop)
                  <InfoTip term="vfc" id="rmssd" />
                </span>
                <MetricChart
                  points={recovery.hrvRmssd.points}
                  windowStart={windowStart}
                  today={t.today}
                  yMin={0}
                  yMax={Math.max(...recovery.hrvRmssd.points.map((p) => p.value)) + 10}
                  mean={recovery.hrvRmssd.mean}
                  strokeClass="stroke-flood"
                  label="VFC RMSSD últimos 28 días"
                  connectGaps
                />
              </div>
            ) : null}
            {recovery.hrvSdnn.points.length > 0 ? (
              <div>
                <span className="mb-1 flex items-center gap-1.5 text-xs text-dim">
                  VFC (SDNN, Apple)
                  <InfoTip term="vfc" id="sdnn" />
                </span>
                <MetricChart
                  points={recovery.hrvSdnn.points}
                  windowStart={windowStart}
                  today={t.today}
                  yMin={0}
                  yMax={Math.max(...recovery.hrvSdnn.points.map((p) => p.value)) + 10}
                  mean={recovery.hrvSdnn.mean}
                  strokeClass="stroke-flood"
                  label="VFC SDNN últimos 28 días"
                  connectGaps
                />
              </div>
            ) : null}
            {recovery.restingHr.points.length > 0 ? (
              <div>
                <span className="mb-1 flex items-center gap-1.5 text-xs text-dim">
                  FC en reposo
                  <InfoTip term="fc_reposo" id="trends" />
                </span>
                <MetricChart
                  points={recovery.restingHr.points}
                  windowStart={windowStart}
                  today={t.today}
                  yMin={Math.min(...recovery.restingHr.points.map((p) => p.value)) - 5}
                  yMax={Math.max(...recovery.restingHr.points.map((p) => p.value)) + 5}
                  mean={recovery.restingHr.mean}
                  strokeClass="stroke-high"
                  label="FC en reposo últimos 28 días"
                  connectGaps
                />
              </div>
            ) : null}
            {recovery.sleepDevice.points.length > 0 ? (
              <div>
                <span className="mb-1 block text-xs text-dim">Sueño (dispositivo)</span>
                <MetricChart
                  points={recovery.sleepDevice.points}
                  windowStart={windowStart}
                  today={t.today}
                  yMin={sleepMin}
                  yMax={sleepMax}
                  mean={recovery.sleepDevice.mean}
                  strokeClass="stroke-sleep"
                  label="Sueño (dispositivo) últimos 28 días"
                  connectGaps
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-faint">
            Conectá una fuente en Fuentes para ver datos objetivos de recuperación.
          </p>
        )}
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
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            Peso corporal
          </h2>
          <span className="font-mono text-[10px] text-faint">últimos 90 días</span>
        </div>
        <MetricChart
          points={outcomes.bodyweight.points}
          windowStart={windowStart90}
          today={t.today}
          yMin={bodyweightValues.length > 0 ? Math.min(...bodyweightValues) - 1 : 0}
          yMax={bodyweightValues.length > 0 ? Math.max(...bodyweightValues) + 1 : 1}
          mean={null}
          strokeClass="stroke-chalk"
          label="Peso corporal últimos 90 días"
          connectGaps
        />
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            <span>e1RM</span>
            <InfoTip term="e1rm" id="trends" />
          </h2>
          <span className="font-mono text-[10px] text-faint">últimos 90 días</span>
        </div>
        {lifts.length === 0 ? (
          <p className="text-sm text-faint">Sin datos todavía.</p>
        ) : (
          <div className="space-y-4">
            {lifts.map((l) => {
              const series = outcomes.e1rm[l];
              const values = series.points.map((p) => p.value);
              return (
                <div key={l}>
                  <span className="mb-1 block text-xs text-dim">{LIFT_LABEL[l]}</span>
                  <MetricChart
                    points={series.points}
                    windowStart={windowStart90}
                    today={t.today}
                    yMin={Math.min(...values) - 5}
                    yMax={Math.max(...values) + 5}
                    mean={null}
                    strokeClass="stroke-flood"
                    label={`e1RM ${LIFT_LABEL[l]} últimos 90 días`}
                    connectGaps
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            <span>Ritmo</span>
            <InfoTip term="ritmo" id="trends" />
          </h2>
          {outcomes.pace.last !== null ? (
            <span className="font-mono text-[10px] text-faint">
              último {formatPace(outcomes.pace.last.value)} /km
              {outcomes.pace.mean !== null ? ` · media ${formatPace(outcomes.pace.mean)}` : ''}
            </span>
          ) : null}
        </div>
        <MetricChart
          points={outcomes.pace.points}
          windowStart={windowStart90}
          today={t.today}
          yMin={
            outcomes.pace.points.length > 0
              ? Math.min(...outcomes.pace.points.map((p) => p.value)) - 0.5
              : 0
          }
          yMax={
            outcomes.pace.points.length > 0
              ? Math.max(...outcomes.pace.points.map((p) => p.value)) + 0.5
              : 1
          }
          mean={outcomes.pace.mean}
          strokeClass="stroke-chalk"
          label="Ritmo últimos 90 días"
          connectGaps
        />
      </section>

      <section className="rounded-xl border border-line bg-turf p-4">
        <h2 className="mb-2 flex items-baseline justify-between font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
          <span>Partidos</span>
          <span className="font-mono text-[10px] text-faint">últimos 90 días</span>
        </h2>
        <MetricChart
          points={outcomes.matchRating.points}
          windowStart={windowStart90}
          today={t.today}
          yMin={1}
          yMax={5}
          mean={outcomes.matchRating.mean}
          strokeClass="stroke-ok"
          label="Autoevaluación de partidos últimos 90 días"
          connectGaps
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
