# Roadmap notes (V1.x interpretation layer + V2 direction)
# Status: §A SHIPPED as ADR-022 (2026-07-02, session 8). §B's V2.1 OUTCOMES slice SHIPPED
# as ADR-023 (2026-07-03, session 10). §B's V2.2 PASSIVE INPUTS slice SHIPPED as ADR-024
# (2026-07-03, session 11) — Whoop connector fixture-validated, real OAuth pending device
# arrival (see skills.md ritual). §B's V2.3 PATTERN CANDIDATES slice SHIPPED as ADR-025
# (2026-07-07, session 13, branch feat/v2.3-pattern-candidates) — /patrones 5th tab +
# coach briefing section, 56d unlock, not yet merged to main (awaiting Marcos's go).
# §C methodology active.
# Constraint that orders everything: DoD gate = 4-week capture habit. Nothing may ADD
# capture friction until the habit is proven. Interpretation first, passive data second,
# manual capture last.

## A. Interpretation layer (V1.x — cheap, no new data, do first)
Principle: bands/interpretation computed IN THE ENGINE (like acwrBand), UI only renders.
Keeps app + briefing + /coach telling the same story (ADR-003/012: flags, never verdicts).

Current gaps found reading the code (2026-07-02):
1. ACWR: has band pill (low/optimal/caution/high) but no sense of POSITION — add a mini
   gauge/scale 0→2 with shaded zones (0.8–1.3 sweet spot green, 1.3–1.5 amber, >1.5 red)
   and a marker at today's value. Optionally yesterday's ghost marker for direction.
2. Monotony: shown RAW ("38.39") with no reference — meaningless to a human. Foster scale:
   <1.5 ok, 1.5–2.0 caution, >2.0 high. NOTE: monotony explodes when SD→0 (uniform weeks);
   seed data hit 38.39. Band + display cap (e.g. ">5") in engine, not UI.
3. Strain: raw number, no reference at all. It's AU-scaled (personal) — interpret vs the
   subject's own 4-week strain range/percentile, not a universal band.
4. z-badges (readiness/sleep): arrow only, no magnitude — z=-2.78 reads the same as z=-0.6.
   Add magnitude tiers: |z|<0.5 "en tu media", 0.5–1.5 "sobre/bajo tu media",
   ≥1.5 "MUY sobre/bajo tu media" (color escalates).
5. Load numbers: raw AU only. Humans read RELATIVE — add "vs" framing: weekLoad vs previous
   week %, acute vs chronic % (that's ACWR restated, pick one). Keep AU as the mono detail.
6. Weekly table: no signal coloring — tint monotony/load cells when out of band; ▲▼ % vs
   previous week on load.
7. Trends: no ACWR-over-time chart — add an ACWR ribbon (line + shaded 0.8–1.3 green band,
   amber/red zones) so drift is visible BEFORE it flags. LoadChart's acute/chronic crossing
   is too implicit.
8. Optional header cue: "N señales activas" dot (green/amber/red) — framed as señales,
   NEVER a verdict (ADR-012).
9. REQUIRED (Marcos 2026-07-02): every acronym/jargon term in the UI (ACWR, EWMA, AU,
   sRPE, monotonía, strain, z) gets a tappable info affordance → 2-3 line plain-language
   explanation. Implementation must respect ADR-015 (zero client JS in dashboards):
   native <details> or the HTML popover attribute — verify mobile tap UX at build time.
   Single glossary source (one const map in the engine or a glossary.ts) so wording is
   consistent everywhere the term appears.

## B. V2 direction (discussed, sequencing proposal)
Marcos's goal: many data sources (nutrition, HR, ...) to surface weaknesses/strengths/
patterns that change outcomes. Key insight from discussion: the missing half is OUTCOMES —
we capture inputs (load) and state (wellness) but no performance markers, so "patterns
that make me better/worse" is currently unanswerable. More inputs alone won't fix that.

Proposed order (signal-per-friction):
- V2.0 Interpretation layer (section A). No new capture.
- V2.1 OUTCOMES, minimal manual — SHIPPED as ADR-023 (2026-07-03): bodyweight (1 number,
  ~weekly), per-modality performance marker on the session form (gym: top-set weight×reps
  → e1RM trend; running: distance → pace trend since duration exists; rugby: post-match
  self-rating 1–5). Observation spine (ADR-007) makes each a new metric_key, no schema
  surgery. Also included nutrition ordinal (below) a version early, per Marcos's decision.
- V2.2 PASSIVE inputs — SHIPPED as ADR-024 (2026-07-03): 5 new recovery-domain metrics
  (recovery_score/hrv_rmssd/hrv_sdnn/resting_hr/sleep_device) via a new raw/import path
  (device_connections + import_batches tables, import_observations RPC). Apple bridge =
  Health Auto Export file import (real data flowing from Marcos's Series 10). Whoop = full
  OAuth2 connector, fixture-validated, env-gated "Próximamente" until devices arrive
  (WHOOP_CLIENT_ID/SECRET/REDIRECT_URI unset). Device sleep prefills (not replaces) the
  manual check-in field. Surfaced in Tendencias "Recuperación", briefing, glossary.
- V2.3 PATTERN CANDIDATES — SHIPPED as ADR-025 (2026-07-07): binned-comparison + Cohen's d
  + Spearman-concordance-veto engine over a curated ~15-pair grid (sleep, alcohol/caffeine,
  training load, recovery→performance), lag-0 joins, 56d unlock (n≈8 horizon), top-3
  surfaced with effect + n + confounder caveats on a new /patrones tab and in the coach
  briefing (same statement builder, ADR-016 same-story invariant), feeding /coach which
  may label a candidate as a HYPOTHESIS citing exact effect+n, never as cause (ADR-003
  contract: code computes, LLM interprets). Compute-on-read, never persisted (ADR-014).
- Nutrition: do NOT build macro logging (highest-friction, highest-abandonment domain).
  Ordinal in the check-in — SHIPPED as part of ADR-023 (2026-07-03): 1-tap "¿comiste
  acorde?" 1–5 + alcohol/caffeine booleans. Full nutrition only if a hypothesis demands it.

## C. Development methodology (Marcos 2026-07-02): seed-first validation
Time-gated unlocks (28d ACWR, 8+ wk pattern candidates) must NEVER block development or
demos. Every V2 feature ships with an extended seed narrative on the DISPOSABLE demo
subject (ADR-020 pattern: reuse the real write path, idempotent, --dry-run previews the
real engine) that exercises the new feature end-to-end — e.g. pattern-candidates gets a
12-week narrative with a planted association; Whoop import gets synthetic recovery/HRV
fixtures. Real users' DoD clock stays clean (demo data excluded, ADR-020).
