import { z } from 'zod';

/** Whoop v2 token response (OAuth2). Refresh tokens ROTATE — persist both atomically. */
export const whoopTokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.string().optional(),
});
export type WhoopTokenResponse = z.infer<typeof whoopTokenResponse>;

const scoreState = z.string();

export const whoopRecovery = z.looseObject({
  cycle_id: z.union([z.string(), z.number()]),
  sleep_id: z.union([z.string(), z.number()]).nullable().optional(),
  score_state: scoreState,
  score: z
    .looseObject({
      recovery_score: z.number().optional(),
      hrv_rmssd_milli: z.number().optional(),
      resting_heart_rate: z.number().optional(),
    })
    .optional(),
});
export type WhoopRecovery = z.infer<typeof whoopRecovery>;

export const whoopSleep = z.looseObject({
  id: z.union([z.string(), z.number()]),
  start: z.string(),
  end: z.string(),
  nap: z.boolean().optional(),
  score_state: scoreState,
  score: z
    .looseObject({
      stage_summary: z
        .looseObject({
          total_light_sleep_time_milli: z.number().optional(),
          total_slow_wave_sleep_time_milli: z.number().optional(),
          total_rem_sleep_time_milli: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});
export type WhoopSleep = z.infer<typeof whoopSleep>;

export const whoopPaginatedResponse = <T extends z.ZodTypeAny>(record: T) =>
  z.object({
    records: z.array(record),
    next_token: z.string().nullable().optional(),
  });
