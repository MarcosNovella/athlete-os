-- ============================================================================
-- V2.2 Passive inputs / wearables (ADR-024). New RAW-class metrics fed by
-- devices (Whoop API, Apple Health Auto Export file). Two new tables:
--   device_connections — one row per (subject, provider), OAuth token pair.
--   import_batches     — append-only audit row per ingest (file or API pull).
-- Both RLS-first (R2), owner-only via subjects, same pattern as existing tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- New metric registry rows (domain 'recovery'). raw class, provenance 'import'.
-- ----------------------------------------------------------------------------
insert into public.metrics (key, label, unit, domain, direction, derived, description) values
  ('recovery_score', 'Recovery score',        'percent', 'recovery', 'higher_better', false, 'Whoop daily recovery score, 0-100'),
  ('hrv_rmssd',      'HRV (RMSSD)',           'ms',      'recovery', 'higher_better', false, 'Heart rate variability, RMSSD method (Whoop)'),
  ('hrv_sdnn',       'HRV (SDNN)',            'ms',      'recovery', 'higher_better', false, 'Heart rate variability, SDNN method (Apple Health)'),
  ('resting_hr',     'Resting heart rate',    'bpm',     'recovery', 'lower_better',  false, 'Resting heart rate (Whoop or Apple Health)'),
  ('sleep_device',   'Sleep duration (device)', 'hours', 'recovery', 'higher_better', false, 'Objective sleep duration from a connected device')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- device_connections — one row per (subject, provider). Access: owner.
-- Apple's file-import path never gets a row here (no tokens/cursor to hold).
-- ----------------------------------------------------------------------------
create table public.device_connections (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  provider text not null check (provider in ('whoop')),
  status text not null default 'connected' check (status in ('connected', 'reauth_required')),
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  external_user_id text,
  scope text not null,
  last_synced_at timestamptz,
  last_sync_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_connections_unique_provider unique (subject_id, provider)
);

alter table public.device_connections enable row level security;

create policy "device_connections: owner full access" on public.device_connections
  for all to authenticated
  using (exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  ));

-- ----------------------------------------------------------------------------
-- import_batches — append-only audit row per ingest. Access: owner.
-- ----------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  provider text not null check (provider in ('whoop', 'apple_health')),
  kind text not null check (kind in ('file', 'api')),
  file_name text,
  observation_count integer not null default 0,
  date_min date,
  date_max date,
  created_at timestamptz not null default now()
);

create index import_batches_subject_created_idx
  on public.import_batches (subject_id, created_at desc);

alter table public.import_batches enable row level security;

create policy "import_batches: owner full access" on public.import_batches
  for all to authenticated
  using (exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  ));

-- ============================================================================
-- import_observations — atomic RPC (mirrors save_daily_checkin/save_training_
-- session, ADR-011): inserts the batch row (count/date range server-side),
-- then upserts observations hardcoded to source='import'. Because `source` is
-- part of the observations_dedupe key, this upsert can only converge onto
-- other import rows — manual/emitted rows are unreachable. No delete phase:
-- raw class means the upsert IS the edit (re-imports and Whoop revisions
-- converge idempotently by re-pointing source_entity_id at the newest batch).
-- ============================================================================
create or replace function public.import_observations(batch jsonb, observations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_subject uuid := (batch ->> 'subject_id')::uuid;
  v_count integer;
  v_date_min date;
  v_date_max date;
begin
  select count(*), min(o.effective_date), max(o.effective_date)
    into v_count, v_date_min, v_date_max
  from jsonb_to_recordset(observations) as o(effective_date date);

  if v_count > 10000 then
    raise exception 'import_observations: batch too large (% rows, max 10000)', v_count;
  end if;

  insert into public.import_batches
    (subject_id, provider, kind, file_name, observation_count, date_min, date_max)
  values (
    v_subject,
    batch ->> 'provider',
    batch ->> 'kind',
    batch ->> 'file_name',
    v_count,
    v_date_min,
    v_date_max
  )
  returning id into v_batch_id;

  insert into public.observations
    (subject_id, metric_key, value, effective_at, effective_date,
     source, source_entity_type, source_entity_id, backfilled)
  select
    v_subject, o.metric_key, o.value, o.effective_at, o.effective_date,
    'import', 'import_batch', v_batch_id, false
  from jsonb_to_recordset(observations)
    as o(metric_key text, value numeric, effective_at timestamptz, effective_date date)
  on conflict on constraint observations_dedupe do update set
    value = excluded.value,
    source_entity_id = excluded.source_entity_id,
    recorded_at = now();

  return v_batch_id;
end;
$$;

revoke execute on function public.import_observations(jsonb, jsonb) from public, anon;
grant execute on function public.import_observations(jsonb, jsonb) to authenticated;
