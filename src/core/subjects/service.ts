import type { Tables } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

export type Subject = Tables<'subjects'>;

/** The signed-in user's subject row, or null (not signed in / not onboarded yet). */
export async function getCurrentSubject(): Promise<Subject | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`subjects lookup failed: ${error.message}`);
  return data;
}
