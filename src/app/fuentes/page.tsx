import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { createClient } from '@/lib/supabase/server';
import { TabNav } from '@/modules/fitness/dashboard/TabNav';
import { AppleImportCard } from '@/modules/fitness/integrations/AppleImportCard';
import { getWhoopConfig } from '@/modules/fitness/integrations/whoop/config';
import {
  WhoopCard,
  type WhoopCardConnection,
} from '@/modules/fitness/integrations/whoop/WhoopCard';

function toWhoopCardConnection(
  row: {
    status: string;
    last_synced_at: string | null;
    last_sync_status: string | null;
  } | null,
): WhoopCardConnection {
  if (!row) return null;
  return {
    status: row.status === 'reauth_required' ? 'reauth_required' : 'connected',
    last_synced_at: row.last_synced_at,
    last_sync_status: row.last_sync_status,
  };
}

export default async function FuentesPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect('/');

  const supabase = await createClient();
  const [latestApple, whoopConnection] = await Promise.all([
    supabase
      .from('import_batches')
      .select('id, file_name, observation_count, date_min, date_max, created_at')
      .eq('subject_id', subject.id)
      .eq('provider', 'apple_health')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from('device_connections')
      .select('status, last_synced_at, last_sync_status')
      .eq('subject_id', subject.id)
      .eq('provider', 'whoop')
      .maybeSingle()
      .then((r) => r.data),
  ]);

  const whoopEnabled = getWhoopConfig() !== null;

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

      <WhoopCard enabled={whoopEnabled} connection={toWhoopCardConnection(whoopConnection)} />

      <AppleImportCard latestBatch={latestApple ?? null} />
    </main>
  );
}
