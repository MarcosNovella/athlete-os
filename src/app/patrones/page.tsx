import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { PatternsSection } from '@/modules/fitness/dashboard/PatternsSection';
import { SignalsCue } from '@/modules/fitness/dashboard/SignalsCue';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
import { getEngineSnapshot, getPatternCandidates } from '@/modules/fitness/engine/service';
import { signalSummary } from '@/modules/fitness/engine/snapshot';

export default async function PatronesPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect('/');

  // Same per-request observation fetch as the other tabs (React cache in service.ts).
  const [data, snapshot] = await Promise.all([
    getPatternCandidates(subject),
    getEngineSnapshot(subject),
  ]);

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-16">
      <header className="pt-2">
        <div className="flex items-end justify-between">
          <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
            Patrones
          </h1>
          <SignalsCue summary={signalSummary(snapshot.flags)} linkToToday />
        </div>
        <p className="mt-1 font-mono text-[10px] text-faint">sobre tus últimos ≤90 días</p>
      </header>

      <TabNav active="patterns" />

      <PatternsSection data={data} />
    </main>
  );
}
