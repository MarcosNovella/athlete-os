-- Covering index for the observations.metric_key FK (performance advisor INFO).
-- Subject-scoped queries use observations_subject_metric_date_idx; this one covers
-- metric-first access and FK integrity checks against the metrics registry.
create index observations_metric_key_idx on public.observations (metric_key);
