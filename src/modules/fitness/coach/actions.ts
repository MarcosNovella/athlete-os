'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentSubject } from '@/core/subjects/service';
import { createClient } from '@/lib/supabase/server';

const statusInput = z.object({
  id: z.uuid(),
  status: z.enum(['confirmed', 'rejected']),
});

/** Confirm/reject a proposed hypothesis (D2: the human closes the loop). */
export async function updateInsightStatus(formData: FormData): Promise<void> {
  const parsed = statusInput.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  });
  if (!parsed.success) return;

  const subject = await getCurrentSubject();
  if (!subject) return;

  const supabase = await createClient();
  await supabase
    .from('insights')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('subject_id', subject.id);
  revalidatePath('/coach');
}
