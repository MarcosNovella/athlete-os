import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { addDaysIso, localDateInTz } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { updateInsightStatus } from '@/modules/fitness/coach/actions';
import { buildBriefing } from '@/modules/fitness/coach/briefing';
import { CopyButton } from '@/modules/fitness/coach/CopyButton';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
import { getEngineSnapshot, getTrends } from '@/modules/fitness/engine/service';

const KIND_LABEL: Record<string, string> = {
  hypothesis: 'Hipótesis',
  weekly_synthesis: 'Síntesis semanal',
  flag: 'Alerta',
};

const STATUS_LABEL: Record<string, string> = {
  proposed: 'propuesta',
  confirmed: 'confirmada',
  rejected: 'rechazada',
  archived: 'archivada',
};

const STATUS_STYLE: Record<string, string> = {
  proposed: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-zinc-100 text-zinc-500',
  archived: 'bg-zinc-100 text-zinc-500',
};

export default async function CoachPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect('/');

  const today = localDateInTz(subject.timezone);
  const supabase = await createClient();

  const [snapshot, trends, sessions, insights] = await Promise.all([
    getEngineSnapshot(subject),
    getTrends(subject),
    supabase
      .from('training_sessions')
      .select('date, modality, duration_min, srpe, load, notes')
      .eq('subject_id', subject.id)
      .gte('date', addDaysIso(today, -6))
      .lte('date', today)
      .order('date', { ascending: true })
      .then((r) => r.data ?? []),
    supabase
      .from('insights')
      .select(
        'id, kind, statement, confidence, status, window_start, window_end, created_at, model',
      )
      .eq('subject_id', subject.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then((r) => r.data ?? []),
  ]);

  const briefing = buildBriefing({
    displayName: subject.display_name,
    snapshot,
    trends,
    recentSessions: sessions,
  });

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-16">
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Coach</h1>
        <p className="text-sm text-zinc-500">síntesis, hipótesis y tu briefing</p>
      </header>

      <TabNav active="coach" />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Insights</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Sin insights todavía. Se generan con la síntesis semanal (/coach) o los cargás al
            confirmar patrones.
          </p>
        ) : (
          <ul className="space-y-3">
            {insights.map((i) => (
              <li key={i.id} className="rounded-xl border border-zinc-100 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                    {KIND_LABEL[i.kind] ?? i.kind}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[i.status] ?? ''}`}
                  >
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                  {i.confidence ? (
                    <span className="text-zinc-400">confianza {i.confidence}</span>
                  ) : null}
                  {i.window_start ? (
                    <span className="text-zinc-400">
                      {i.window_start} → {i.window_end ?? '…'}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm">{i.statement}</p>
                {i.kind === 'hypothesis' && i.status === 'proposed' ? (
                  <div className="mt-2 flex gap-2">
                    <form action={updateInsightStatus} className="flex-1">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="status" value="confirmed" />
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white"
                      >
                        Confirmar
                      </button>
                    </form>
                    <form action={updateInsightStatus} className="flex-1">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-zinc-200 py-2 text-sm font-medium text-zinc-700"
                      >
                        Rechazar
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold">Briefing para la IA</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Tu estado completo, calculado por el motor, listo para pegar en claude.ai (u otra IA) y
          conversar. Incluye las reglas para que razone solo sobre tus números.
        </p>
        <CopyButton text={briefing} />
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-zinc-500">Ver briefing</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700">
            {briefing}
          </pre>
        </details>
      </section>
    </main>
  );
}
