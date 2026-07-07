import { readFileSync } from 'node:fs';
import { localDateInTz } from '../src/lib/dates';
import { buildBriefing, type RecentSession } from '../src/modules/fitness/coach/briefing';
import { computePatternCandidates } from '../src/modules/fitness/engine/patterns';
import { computeSnapshot, type ObservationLite } from '../src/modules/fitness/engine/snapshot';
import { computeTrends } from '../src/modules/fitness/engine/trends';

/**
 * Deterministic briefing for the /coach skill (ADR-016).
 * Input: a JSON file with raw spine data (fetched by the skill via MCP).
 * Output: the briefing on stdout — the LLM never does the math (D2).
 *
 * Usage: pnpm briefing <raw-data.json>
 * Expected JSON shape:
 * {
 *   "subject": { "display_name": string, "timezone": string },
 *   "observations": [{ "metric_key": string, "value": number, "effective_date": "YYYY-MM-DD" }],
 *   "sessions": [{ "date": "YYYY-MM-DD", "modality": string, "duration_min": number,
 *                  "srpe": number, "load": number | null, "notes": string | null }]
 * }
 */

type RawData = {
  subject: { display_name: string; timezone: string };
  observations: ObservationLite[];
  sessions: RecentSession[];
};

const path = process.argv[2];
if (!path) {
  console.error('Usage: pnpm briefing <raw-data.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, 'utf8')) as RawData;
if (!raw.subject?.timezone || !Array.isArray(raw.observations) || !Array.isArray(raw.sessions)) {
  console.error('Invalid raw data: expected { subject, observations, sessions }');
  process.exit(1);
}

const today = localDateInTz(raw.subject.timezone);
const snapshot = computeSnapshot(raw.observations, today);
const trends = computeTrends(raw.observations, today);
const patterns = computePatternCandidates(raw.observations, today);

console.log(
  buildBriefing({
    displayName: raw.subject.display_name,
    snapshot,
    trends,
    patterns,
    recentSessions: raw.sessions,
  }),
);
