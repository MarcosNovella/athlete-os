import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { createClient } from '@/lib/supabase/server';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
import { AppleImportCard } from '@/modules/fitness/integrations/AppleImportCard';

export default async function FuentesPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect('/');

  const supabase = await createClient();
  const latestApple = await supabase
    .from('import_batches')
    .select('id, file_name, observation_count, date_min, date_max, created_at')
    .eq('subject_id', subject.id)
    .eq('provider', 'apple_health')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .then((r) => r.data);

  const whoopEnabled = Boolean(process.env.WHOOP_CLIENT_ID);

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-16">
      <header className="pt-2">
        <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-tight">
          Fuentes
        </h1>
        <p className="mt-1 font-mono text-[10px] text-faint">
          conectá dispositivos para datos objetivos de recuperación
        </p>
      </header>

      <TabNav active="sources" />

      <section className="rounded-xl border border-line bg-turf p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-dim">
            Whoop
          </h2>
          <span className="rounded-full bg-turf-2 px-2 py-0.5 text-xs font-medium text-faint">
            Próximamente
          </span>
        </div>
        <p className="text-sm text-faint">
          {whoopEnabled
            ? 'Configurado — conexión disponible pronto en esta página.'
            : 'Todavía no configurado. Se habilita cuando lleguen los relojes Whoop.'}
        </p>
      </section>

      <AppleImportCard latestBatch={latestApple ?? null} />
    </main>
  );
}
