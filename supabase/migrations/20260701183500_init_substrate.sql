-- ============================================================================
-- Athlete OS — foundational substrate
-- Design: ADR-007 (hybrid spine), ADR-011 (spine fine print), ADR-012 (engine
-- metrics), ADR-013 (capture), D7 (private silos). See .agent/decisions.md.
--
-- Provenance classes (ADR-011):
--   raw (manual|import) → the observation IS the truth, directly editable.
--   emitted             → truth = the typed entity; rebuildable projection.
--   derived             → truth = the deterministic engine; recomputed.
-- Emission happens in the APP LAYER in the same transaction (no DB triggers).
-- updated_at is app-managed (server actions set it on update).
-- Harness R2: every table enables RLS + explicit policies in THIS file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- subjects — athlete identity (shared core). Access: owner.
-- ----------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "subjects: owner full access" on public.subjects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- metrics — global registry (ADR-011: one canonical unit per metric; new
-- metrics are a ROW, not a migration... but seeds still ship via migrations).
-- Access: authenticated read-only; no client write policies (service/migrations only).
-- ----------------------------------------------------------------------------
create table public.metrics (
  key text primary key,
  label text not null,
  unit text not null,
  domain text not null,
  direction text not null default 'neutral'
    check (direction in ('higher_better', 'lower_better', 'neutral')),
  derived boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

alter table public.metrics enable row level security;

create policy "metrics: authenticated can read" on public.metrics
  for select to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- observations — the canonical time-series spine (ADR-007/011). Access: owner
-- via subject. Values are numeric-only in MVP; unit lives on the metric.
-- ----------------------------------------------------------------------------
create table public.observations (
  id uuid primary key default gen_random_uuid(), -- client sends UUIDv7; default covers server writes
  subject_id uuid not null references public.subjects (id) on delete cascade,
  metric_key text not null references public.metrics (key),
  value numeric not null,
  effective_at timestamptz not null,             -- when it happened
  effective_date date not null,                  -- local daily semantics (computed at write boundary)
  recorded_at timestamptz not null default now(),-- when it was logged
  source text not null check (source in ('manual', 'import', 'emitted', 'derived')),
  source_entity_type text,
  source_entity_id uuid,
  backfilled boolean not null default false,
  -- emitted observations MUST link back to their source entity (ADR-011)
  constraint observations_emitted_requires_link check (
    source <> 'emitted' or (source_entity_type is not null and source_entity_id is not null)
  ),
  -- dedupe key (ADR-011): offline replays and re-imports never duplicate
  constraint observations_dedupe unique (subject_id, metric_key, effective_at, source)
);

create index observations_subject_metric_date_idx
  on public.observations (subject_id, metric_key, effective_date desc);

alter table public.observations enable row level security;

create policy "observations: owner full access" on public.observations
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
-- daily_checkins — typed capture entity (ADR-013). Access: owner via subject.
-- One per subject per local date (ADR-011); reopening the form edits it.
-- ----------------------------------------------------------------------------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  date date not null,
  sleep_hours numeric(4, 2) not null check (sleep_hours >= 0 and sleep_hours <= 24),
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  readiness smallint not null check (readiness between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  backfilled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checkins_one_per_day unique (subject_id, date)
);

alter table public.daily_checkins enable row level security;

create policy "daily_checkins: owner full access" on public.daily_checkins
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
-- training_sessions — typed capture entity (ADR-012/013). Access: owner via
-- subject. load = duration × sRPE (Foster) as a stored generated column.
-- ----------------------------------------------------------------------------
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  modality text not null check (modality in ('rugby', 'gym', 'running')),
  started_at timestamptz not null,
  date date not null,
  duration_min integer not null check (duration_min > 0 and duration_min <= 600),
  srpe smallint not null check (srpe between 1 and 10),
  load numeric generated always as (duration_min * srpe) stored,
  notes text,
  backfilled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_sessions_subject_date_idx
  on public.training_sessions (subject_id, date desc);

alter table public.training_sessions enable row level security;

create policy "training_sessions: owner full access" on public.training_sessions
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
-- insights — AI output, always labeled, human-confirmable (ADR-009/D8).
-- Access: owner via subject.
-- ----------------------------------------------------------------------------
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  kind text not null check (kind in ('hypothesis', 'weekly_synthesis', 'flag')),
  statement text not null,
  evidence jsonb not null default '{}'::jsonb,   -- metric keys, values, windows cited
  confidence text check (confidence in ('low', 'medium', 'high')),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'rejected', 'archived')),
  window_start date,
  window_end date,
  model text,                                    -- which LLM produced it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insights_subject_status_idx
  on public.insights (subject_id, status, created_at desc);

alter table public.insights enable row level security;

create policy "insights: owner full access" on public.insights
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
-- Seed the MVP metric registry (ADR-012). direction guides dashboard/AI framing.
-- ----------------------------------------------------------------------------
insert into public.metrics (key, label, unit, domain, direction, derived, description) values
  ('sleep_duration',   'Sleep duration',        'hours',     'readiness', 'higher_better', false, 'Hours slept last night (belongs to the morning''s date)'),
  ('sleep_quality',    'Sleep quality',         'score_1_5', 'readiness', 'higher_better', false, 'Subjective sleep quality, 1-5'),
  ('readiness',        'Readiness',             'score_1_5', 'readiness', 'higher_better', false, 'Subjective readiness/energy, 1-5'),
  ('soreness',         'Muscle soreness',       'score_1_5', 'readiness', 'lower_better',  false, 'Subjective muscle soreness, 1-5'),
  ('stress',           'Stress',                'score_1_5', 'readiness', 'lower_better',  false, 'Subjective stress/mood, 1-5'),
  ('session_srpe',     'Session RPE',           'rpe',       'training',  'neutral',       false, 'Foster session RPE, 1-10'),
  ('session_duration', 'Session duration',      'minutes',   'training',  'neutral',       false, 'Session duration in minutes'),
  ('session_load',     'Session load',          'au',        'training',  'neutral',       false, 'sRPE x duration (Foster), arbitrary units'),
  ('daily_load',       'Daily training load',   'au',        'training',  'neutral',       true,  'Sum of session loads per local date (0 on rest days)'),
  ('acute_load_7d',    'Acute load (EWMA 7d)',  'au',        'training',  'neutral',       true,  'EWMA of daily load, 7-day time constant'),
  ('chronic_load_28d', 'Chronic load (EWMA 28d)','au',       'training',  'neutral',       true,  'EWMA of daily load, 28-day time constant'),
  ('acwr',             'ACWR',                  'ratio',     'training',  'neutral',       true,  'Acute:chronic workload ratio (EWMA). Heuristic FLAG, never a verdict (ADR-012)'),
  ('monotony',         'Training monotony',     'ratio',     'training',  'neutral',       true,  'Weekly mean daily load / SD (Foster)'),
  ('strain',           'Training strain',       'au',        'training',  'neutral',       true,  'Weekly load x monotony (Foster)');
