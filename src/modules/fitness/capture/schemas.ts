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
});
export type CheckInInput = z.infer<typeof checkInInput>;

export const MODALITIES = ['rugby', 'gym', 'running'] as const;
export type Modality = (typeof MODALITIES)[number];

export const sessionInput = z.object({
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
});
export type SessionInput = z.infer<typeof sessionInput>;
