/**
 * Shared shapes for passive-input providers (ADR-024). Every provider
 * (Whoop API, Apple Health Auto Export file) maps its raw payload into this
 * canonical shape BEFORE it ever touches the DB — the write path
 * (`import_observations` RPC) only ever sees DeviceObservation rows.
 */

export type DeviceMetricKey =
  | 'recovery_score'
  | 'hrv_rmssd'
  | 'hrv_sdnn'
  | 'resting_hr'
  | 'sleep_device';

export type DeviceObservation = {
  metric_key: DeviceMetricKey;
  value: number;
  date: string; // YYYY-MM-DD, wake-date attribution (D4)
};

export type ImportProvider = 'whoop' | 'apple_health';
export type ImportKind = 'file' | 'api';
