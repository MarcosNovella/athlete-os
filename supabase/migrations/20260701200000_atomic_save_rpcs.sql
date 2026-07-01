-- ============================================================================
-- Atomic save + re-emit RPCs (ADR-011).
-- The app layer computes the emitted observation rows in TypeScript (pure,
-- Vitest-tested); these functions only provide ATOMICITY: upsert the typed
-- entity, wipe its previously emitted observations, insert the new projection.
-- The linkage fields (subject_id, source, source_entity_*) are ALWAYS rewritten
-- server-side from the entity row — the payload cannot forge them.
-- security invoker: RLS on the underlying tables enforces ownership.
-- ============================================================================

create function public.save_daily_checkin(checkin jsonb, observations jsonb)
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
    (subject_id, date, sleep_hours, sleep_quality, readiness, soreness, stress, backfilled)
  values (
    (checkin ->> 'subject_id')::uuid,
    (checkin ->> 'date')::date,
    (checkin ->> 'sleep_hours')::numeric,
    (checkin ->> 'sleep_quality')::smallint,
    (checkin ->> 'readiness')::smallint,
    (checkin ->> 'soreness')::smallint,
    (checkin ->> 'stress')::smallint,
    coalesce((checkin ->> 'backfilled')::boolean, false)
  )
  on conflict (subject_id, date) do update set
    sleep_hours = excluded.sleep_hours,
    sleep_quality = excluded.sleep_quality,
    readiness = excluded.readiness,
    soreness = excluded.soreness,
    stress = excluded.stress,
    backfilled = excluded.backfilled,
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

create function public.save_training_session(session jsonb, observations jsonb)
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
    (id, subject_id, modality, started_at, date, duration_min, srpe, notes, backfilled)
  values (
    coalesce((session ->> 'id')::uuid, gen_random_uuid()),
    (session ->> 'subject_id')::uuid,
    session ->> 'modality',
    (session ->> 'started_at')::timestamptz,
    (session ->> 'date')::date,
    (session ->> 'duration_min')::integer,
    (session ->> 'srpe')::smallint,
    session ->> 'notes',
    coalesce((session ->> 'backfilled')::boolean, false)
  )
  on conflict (id) do update set
    modality = excluded.modality,
    started_at = excluded.started_at,
    date = excluded.date,
    duration_min = excluded.duration_min,
    srpe = excluded.srpe,
    notes = excluded.notes,
    backfilled = excluded.backfilled,
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
