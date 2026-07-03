'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSubject } from '@/core/subjects/service';
import { createClient } from '@/lib/supabase/server';
import { parseHaeExport } from './hae';
import { toImportRows } from './import';

export type UploadResult =
  | { ok: true; observationCount: number; skippedCount: number }
  | { ok: false; error: string };

const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function uploadAppleExport(formData: FormData): Promise<UploadResult> {
  const subject = await getCurrentSubject();
  if (!subject) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Ningún archivo seleccionado.' };
  if (file.size > MAX_FILE_BYTES)
    return { ok: false, error: 'Archivo demasiado grande (máx 4 MB).' };

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }

  const parsed = parseHaeExport(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { rows, droppedCount } = toImportRows(parsed.observations);
  if (rows.length === 0) {
    return {
      ok: false,
      error: 'No se encontraron datos reconocibles (VFC, FC en reposo o sueño) en el export.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('import_observations', {
    batch: {
      subject_id: subject.id,
      provider: 'apple_health',
      kind: 'file',
      file_name: file.name,
    },
    observations: rows,
  });
  if (error) return { ok: false, error: 'No se pudo guardar. Probá de nuevo.' };

  revalidatePath('/fuentes');
  return {
    ok: true,
    observationCount: rows.length,
    skippedCount: parsed.skippedCount + droppedCount,
  };
}
