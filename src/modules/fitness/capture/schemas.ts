import { z } from 'zod';

/** Boundary validation (Harness R5): all capture input crosses through here. */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const checkInInput = z.object({
  date: isoDate,
  sleep_hours: z.number().min(0).max(24).multipleOf(0.25),
  sleep_quality: z.number().int().min(1).max(5),
  readiness: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  // V2.1 outcomes (ADR-023): optional/collapsed so the ~30s check-in holds.
  bodyweight_kg: z.number().min(30).max(250).multipleOf(0.1).optional(),
  nutrition_adherence: z.number().int().min(1).max(5).optional(),
  // .default(false): legacy offline-queued payloads without these keys must
  // keep parsing — queue rejection is terminal (ADR-017).
  alcohol: z.boolean().default(false),
  caffeine: z.boolean().default(false),
});
export type CheckInInput = z.infer<typeof checkInInput>;

export const MODALITIES = ['rugby', 'gym', 'running'] as const;
export type Modality = (typeof MODALITIES)[number];

export const LIFTS = ['squat', 'bench', 'deadlift', 'ohp', 'other'] as const;
export type Lift = (typeof LIFTS)[number];

export const sessionInput = z
  .object({
    id: z.uuid(), // client-generated UUIDv7 (ADR-011): retries/replays never duplicate
    date: isoDate,
    modality: z.enum(MODALITIES),
    duration_min: z.number().int().min(1).max(600),
    srpe: z.number().int().min(1).max(10),
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((s) => (s.length === 0 ? undefined : s))
      .optional(),
    // V2.1 outcomes (ADR-023), all modality-conditional (see superRefine below).
    lift: z.enum(LIFTS).optional(),
    // Epley is unreliable past ~12 reps; a top set is low-rep by definition.
    top_set_weight_kg: z.number().min(1).max(500).multipleOf(0.5).optional(),
    top_set_reps: z.number().int().min(1).max(12).optional(),
    distance_km: z.number().min(0.5).max(100).multipleOf(0.1).optional(),
    is_match: z.boolean().default(false),
    match_rating: z.number().int().min(1).max(5).optional(),
  })
  .superRefine((input, ctx) => {
    // Forms make invalid states unrepresentable; a rejection here means the
    // client sent something the UI shouldn't be able to produce.
    const topsetFields = [input.lift, input.top_set_weight_kg, input.top_set_reps];
    const topsetCount = topsetFields.filter((f) => f !== undefined).length;
    if (topsetCount !== 0 && topsetCount !== topsetFields.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'lift, top_set_weight_kg y top_set_reps van juntos o ninguno.',
      });
    }
    if (input.lift !== undefined && input.modality !== 'gym') {
      ctx.addIssue({ code: 'custom', message: 'lift solo aplica a modality=gym.' });
    }
    if (input.distance_km !== undefined && input.modality !== 'running') {
      ctx.addIssue({ code: 'custom', message: 'distance_km solo aplica a modality=running.' });
    }
    if (input.is_match && input.modality !== 'rugby') {
      ctx.addIssue({ code: 'custom', message: 'is_match solo aplica a modality=rugby.' });
    }
    if ((input.match_rating !== undefined) !== input.is_match) {
      ctx.addIssue({ code: 'custom', message: 'match_rating es requerido si y solo si is_match.' });
    }
    if (input.distance_km !== undefined) {
      const pace = input.duration_min / input.distance_km;
      if (pace < 2 || pace > 20) {
        ctx.addIssue({ code: 'custom', message: 'Ritmo fuera de rango plausible (2-20 min/km).' });
      }
    }
  });
export type SessionInput = z.infer<typeof sessionInput>;
