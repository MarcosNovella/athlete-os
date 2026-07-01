---
name: coach
description: Weekly performance synthesis for Athlete OS subjects at $0 (runs on the owner's Claude subscription). Fetches spine data via the Supabase MCP, computes the deterministic briefing via script, reasons over it, and writes labeled insights back so they appear in-app. Use when asked to run the coach, weekly synthesis, or "síntesis semanal".
---

# /coach — weekly synthesis (ADR-016)

You produce the weekly synthesis + labeled hypotheses for one or both athletes and
write them into the `insights` table so they render in the app's Coach tab.

## Hard rules (non-negotiable)

- Supabase project id: `zidgpigxtuzpnjvinidx` ONLY. G-000: the project "yogastasis"
  is off-limits — never query, list, or touch it.
- **D2 invariant: never compute metrics yourself.** The `pnpm briefing` script does
  ALL the math; treat its output numbers as ground truth. If a number is not in the
  briefing, you don't have it.
- **D7 privacy discipline:** process ONE subject at a time. Never mix subjects' data
  in a single analysis, never reference one subject's data in another's insight or
  report section. (You run with admin DB access — the wall here is procedural.)
- **D1 safety:** performance-first WITHIN safe limits. Never recommend load jumps
  into the ACWR risk bands. Anything that smells clinical (persistent pain,
  symptoms) → flag it and recommend a professional; never prescribe.
- Insights `statement` text: Spanish, concise, self-contained (it renders in the UI).

## Procedure (repeat per subject; default = all subjects, sequentially)

1. **Subjects** (Supabase MCP `execute_sql`):
   `select id, display_name, timezone from public.subjects order by display_name;`
   If the user named one, process only that one.

2. **Raw data** for the subject (replace `:sid`; note the `::float8` casts — the
   script expects JSON numbers, and `execute_sql` returns numerics as strings):

   ```sql
   select json_build_object(
     'subject', (select json_build_object('display_name', display_name, 'timezone', timezone)
                 from public.subjects where id = ':sid'),
     'observations', coalesce((
       select json_agg(json_build_object(
         'metric_key', metric_key, 'value', value::float8, 'effective_date', effective_date::text)
         order by effective_date)
       from public.observations
       where subject_id = ':sid'
         and metric_key in ('session_load','readiness','sleep_duration')
         and effective_date >= (current_date - 90)), '[]'::json),
     'sessions', coalesce((
       select json_agg(json_build_object(
         'date', date::text, 'modality', modality, 'duration_min', duration_min,
         'srpe', srpe, 'load', load::float8, 'notes', notes)
         order by date)
       from public.training_sessions
       where subject_id = ':sid' and date >= (current_date - 7)), '[]'::json)
   ) as raw;
   ```

3. **Compute the briefing:** save the `raw` JSON to the session scratchpad as
   `<name>-raw.json`, then from the repo root run:
   `pnpm briefing <path-to-json>` — stdout is the deterministic briefing.

4. **Reason** strictly following the briefing's embedded instruction block:
   (a) weekly readout; (b) concrete adjustments for next week; (c) 0–2 hypotheses,
   each with cited evidence from the briefing and a confidence (low/medium/high).
   During the cold-start window, respect what is locked: no ACWR talk before it
   unlocks — use what exists (loads, raw readiness/sleep, streak).

5. **Write back** (one insert per item; `execute_sql`):

   ```sql
   insert into public.insights
     (subject_id, kind, statement, evidence, confidence, status, window_start, window_end, model)
   values
     (':sid', 'weekly_synthesis' /* or 'hypothesis' */, '<Spanish statement>',
      '<jsonb: {"metrics": {...the exact numbers cited...}}', null /* or low|medium|high */,
      'proposed', '<window start YYYY-MM-DD>', '<today YYYY-MM-DD>', 'claude-code');
   ```

   One `weekly_synthesis` per subject per run; hypotheses only when the data
   genuinely suggests them (0 is a valid count).

6. **Report to the user in Spanish:** per subject, the readout + what was written.
   Keep each subject's numbers in their own section only.
