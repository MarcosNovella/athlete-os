-- ============================================================================
-- V2.1 Outcomes (ADR-023). No new tables — nullable column groups on the
-- existing capture entities (daily_checkins, training_sessions), re-emitted
-- as new registry metrics on the existing observation spine (ADR-007).
-- Existing RLS policies on both tables already cover these new columns
-- (policies are row-scoped via subject_id, not column-scoped) — R2 satisfied.
-- Cross-field CHECKs mirror the Zod superRefine so invalid states are
-- unrepresentable even from a buggy/bypassed client.
-- ============================================================================

alter table public.daily_checkins
  add column bodyweight_kg numeric(5, 2) check (bodyweight_kg >= 30 and bodyweight_kg <= 250),
  add column nutrition_adherence smallint check (nutrition_adherence between 1 and 5),
  add column alcohol boolean not null default false,
  add column caffeine boolean not null default false;

alter table public.training_sessions
  add column lift text check (lift in ('squat', 'bench', 'deadlift', 'ohp', 'other')),
  add column top_set_weight_kg numeric(5, 2) check (top_set_weight_kg >= 1 and top_set_weight_kg <= 500),
  add column top_set_reps smallint check (top_set_reps between 1 and 12),
  add column distance_km numeric(5, 2) check (distance_km >= 0.5 and distance_km <= 100),
  add column is_match boolean not null default false,
  add column match_rating smallint check (match_rating between 1 and 5),
  -- topset trio is all-or-nothing, and only meaningful for gym sessions
  add constraint training_sessions_topset_trio check (
    (lift is null and top_set_weight_kg is null and top_set_reps is null)
    or (lift is not null and top_set_weight_kg is not null and top_set_reps is not null)
  ),
  add constraint training_sessions_topset_modality check (
    lift is null or modality = 'gym'
  ),
  add constraint training_sessions_distance_modality check (
    distance_km is null or modality = 'running'
  ),
  add constraint training_sessions_match_modality check (
    not is_match or modality = 'rugby'
  ),
  -- match_rating is required iff is_match (bidirectional; a "rate later" flow
  -- would need a migration — accepted per plan risk list)
  add constraint training_sessions_match_rating_iff_match check (
    (match_rating is not null) = is_match
  );

-- ----------------------------------------------------------------------------
-- New metric registry rows (ADR-011: derived=false — e1RM/pace are computed
-- at EMISSION time in the app layer, provenance 'emitted', rebuildable from
-- the entity; `derived` stays reserved for engine-computed metrics).
-- ----------------------------------------------------------------------------
insert into public.metrics (key, label, unit, domain, direction, derived, description) values
  ('bodyweight',           'Bodyweight',                        'kg',          'body',        'neutral',       false, 'Bodyweight, optional field on the daily check-in'),
  ('e1rm_squat',           'e1RM squat',                         'kg',          'performance', 'higher_better', false, 'Estimated 1RM (Epley) from a gym session top set'),
  ('e1rm_bench',           'e1RM bench press',                   'kg',          'performance', 'higher_better', false, 'Estimated 1RM (Epley) from a gym session top set'),
  ('e1rm_deadlift',        'e1RM deadlift',                      'kg',          'performance', 'higher_better', false, 'Estimated 1RM (Epley) from a gym session top set'),
  ('e1rm_ohp',             'e1RM overhead press',                'kg',          'performance', 'higher_better', false, 'Estimated 1RM (Epley) from a gym session top set'),
  ('running_distance',     'Running distance',                  'km',          'performance', 'neutral',       false, 'Distance covered in a running session'),
  ('running_pace',         'Running pace',                      'min_per_km',  'performance', 'lower_better',  false, 'Average pace for a running session (decimal min/km)'),
  ('match_rating',         'Match self-rating',                 'score_1_5',   'performance', 'higher_better', false, 'Subjective performance rating, rugby matches only'),
  ('nutrition_adherence',  'Nutrition adherence',               'score_1_5',   'nutrition',   'higher_better', false, 'Subjective "ate on plan" rating, optional on the check-in'),
  ('alcohol',              'Alcohol intake',                    'boolean',     'nutrition',   'lower_better',  false, 'Alcohol intake yesterday, 0/1, always emitted'),
  ('caffeine',             'Caffeine intake',                   'boolean',     'nutrition',   'neutral',       false, 'Caffeine intake yesterday, 0/1, always emitted')
on conflict (key) do nothing;

-- ============================================================================
-- Replace save_daily_checkin / save_training_session (ADR-011 atomic RPCs) to
-- carry the new entity columns. Never edit an already-applied migration file —
-- this CREATE OR REPLACE supersedes 20260701200000_atomic_save_rpcs.sql.
-- Observation insert blocks are unchanged: new metrics ride the existing
-- jsonb_to_recordset(observations) path from the app layer.
-- ============================================================================

create or replace function public.save_daily_checkin(checkin jsonb, observations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_subject uuid;
begin
  insert into public.daily_checkins
    (subject_id, date, sleep_hours, sleep_quality, readiness, soreness, stress, backfilled,
     bodyweight_kg, nutrition_adherence, alcohol, caffeine)
  values (
    (checkin ->> 'subject_id')::uuid,
    (checkin ->> 'date')::date,
    (checkin ->> 'sleep_hours')::numeric,
    (checkin ->> 'sleep_quality')::smallint,
    (checkin ->> 'readiness')::smallint,
    (checkin ->> 'soreness')::smallint,
    (checkin ->> 'stress')::smallint,
    coalesce((checkin ->> 'backfilled')::boolean, false),
    (checkin ->> 'bodyweight_kg')::numeric,
    (checkin ->> 'nutrition_adherence')::smallint,
    coalesce((checkin ->> 'alcohol')::boolean, false),
    coalesce((checkin ->> 'caffeine')::boolean, false)
  )
  on conflict (subject_id, date) do update set
    sleep_hours = excluded.sleep_hours,
    sleep_quality = excluded.sleep_quality,
    readiness = excluded.readiness,
    soreness = excluded.soreness,
    stress = excluded.stress,
    backfilled = excluded.backfilled,
    bodyweight_kg = excluded.bodyweight_kg,
    nutrition_adherence = excluded.nutrition_adherence,
    alcohol = excluded.alcohol,
    caffeine = excluded.caffeine,
    updated_at = now()
  returning id, subject_id into v_id, v_subject;

  delete from public.observations
  where source = 'emitted'
    and source_entity_type = 'daily_checkin'
    and source_entity_id = v_id;

  insert into public.observations
    (subject_id, metric_key, value, effective_at, effective_date,
     source, source_entity_type, source_entity_id, backfilled)
  select
    v_subject, o.metric_key, o.value, o.effective_at, o.effective_date,
    'emitted', 'daily_checkin', v_id, coalesce(o.backfilled, false)
  from jsonb_to_recordset(observations)
    as o(metric_key text, value numeric, effective_at timestamptz,
         effective_date date, backfilled boolean);

  return v_id;
end;
$$;

create or replace function public.save_training_session(session jsonb, observations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_subject uuid;
begin
  insert into public.training_sessions
    (id, subject_id, modality, started_at, date, duration_min, srpe, notes, backfilled,
     lift, top_set_weight_kg, top_set_reps, distance_km, is_match, match_rating)
  values (
    coalesce((session ->> 'id')::uuid, gen_random_uuid()),
    (session ->> 'subject_id')::uuid,
    session ->> 'modality',
    (session ->> 'started_at')::timestamptz,
    (session ->> 'date')::date,
    (session ->> 'duration_min')::integer,
    (session ->> 'srpe')::smallint,
    session ->> 'notes',
    coalesce((session ->> 'backfilled')::boolean, false),
    session ->> 'lift',
    (session ->> 'top_set_weight_kg')::numeric,
    (session ->> 'top_set_reps')::smallint,
    (session ->> 'distance_km')::numeric,
    coalesce((session ->> 'is_match')::boolean, false),
    (session ->> 'match_rating')::smallint
  )
  on conflict (id) do update set
    modality = excluded.modality,
    started_at = excluded.started_at,
    date = excluded.date,
    duration_min = excluded.duration_min,
    srpe = excluded.srpe,
    notes = excluded.notes,
    backfilled = excluded.backfilled,
    lift = excluded.lift,
    top_set_weight_kg = excluded.top_set_weight_kg,
    top_set_reps = excluded.top_set_reps,
    distance_km = excluded.distance_km,
    is_match = excluded.is_match,
    match_rating = excluded.match_rating,
    updated_at = now()
  returning id, subject_id into v_id, v_subject;

  delete from public.observations
  where source = 'emitted'
    and source_entity_type = 'training_session'
    and source_entity_id = v_id;

  insert into public.observations
    (subject_id, metric_key, value, effective_at, effective_date,
     source, source_entity_type, source_entity_id, backfilled)
  select
    v_subject, o.metric_key, o.value, o.effective_at, o.effective_date,
    'emitted', 'training_session', v_id, coalesce(o.backfilled, false)
  from jsonb_to_recordset(observations)
    as o(metric_key text, value numeric, effective_at timestamptz,
         effective_date date, backfilled boolean);

  return v_id;
end;
$$;

-- Lock down execution: authenticated users only (RLS still applies inside).
revoke execute on function public.save_daily_checkin(jsonb, jsonb) from public, anon;
revoke execute on function public.save_training_session(jsonb, jsonb) from public, anon;
grant execute on function public.save_daily_checkin(jsonb, jsonb) to authenticated;
grant execute on function public.save_training_session(jsonb, jsonb) to authenticated;
