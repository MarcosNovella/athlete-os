'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const onboardingInput = z.object({
  display_name: z.string().trim().min(1).max(50),
  timezone: z.string().trim().min(1).max(64),
});

/** First-login onboarding: create the user's subject row (D7: one silo per user). */
export async function createSubject(formData: FormData): Promise<void> {
  const parsed = onboardingInput.safeParse({
    display_name: formData.get('display_name'),
    timezone: formData.get('timezone'),
  });
  if (!parsed.success) redirect('/?onboarding=invalid');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('subjects').insert({
    user_id: user.id,
    display_name: parsed.data.display_name,
    timezone: parsed.data.timezone,
  });
  // Unique(user_id) makes a double-submit harmless; anything else should surface.
  if (error && error.code !== '23505') {
    throw new Error(`subject creation failed: ${error.message}`);
  }
  revalidatePath('/');
  redirect('/');
}
