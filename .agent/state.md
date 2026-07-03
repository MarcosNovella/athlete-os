# State
Goal: MVP "Readiness Loop" v1 live + V2 build-out per roadmap. DoD gate: capture habit 4+ weeks (both users). Design memo: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md

Log:
- 2026-07-01 S1-S2: full MVP (scaffold→substrate→capture→engine→dashboards→$0 coach, ADR-001..016) + PWA/offline (ADR-017) + Vercel prod deploy (ADR-018) — LIVE at https://athlete-os-pink.vercel.app. Full episodes: journal.md.
- 2026-07-02 S3-S5: visual redesign ADR-019; demo-subject seed ADR-020 (idempotent, --dry-run, G-007); first /coach run e2e; GitHub repo + Vercel git integration ADR-021 (push main = prod). App on both phones, Thomas logged in (DoD clock running).
- 2026-07-02 S6-S7: roadmap.md written (§A interpretation / §B V2 sequencing approved / §C seed-first); knowledge loop built + run (/harvest, /query, /lint-knowledge, /scaffold inherit; candidates C-001..C-009).
- 2026-07-02 S8: V2.0 interpretation layer SHIPPED (roadmap §A all 9 items, ADR-022) — bands/tiers/deltas in ENGINE, AcwrGauge+ribbon, ZBadges, tinted WeeklyTable, glossary InfoTips (zero JS), señales cue; E2E 27/27. Guardrails G-009/G-010.
- 2026-07-03 S9: planned V2.1 outcomes (plan-only); plan approved at plans\vamos-a-planificar-el-bubbly-feigenbaum.md.
- 2026-07-03 S10: V2.1 OUTCOMES SHIPPED (ADR-023, 123 tests): outcomes migration+RPC replace, per-modality emission (e1RM/pace/match), forms, trends.outcomes 90d, Rendimiento UI, briefing Resultados, seed 324 obs; fixed prod dedupe-collision (staggeredBackfillInstant) + /coach SQL allowlist rot (→C-012). Merged→main, prod smoke OK. Found pre-existing hydration error #418 on "/" (TodayStatePanel InfoTip/Hero markup) — flagged, unfixed. Knowledge loop run.
- 2026-07-03 S11: PLANNED V2.2 PASSIVE INPUTS (plan-only per Marcos "me la pasas y frenamos ahí"). Plan APPROVED at C:\Users\Marcos\.claude\plans\vamos-a-planificar-la-lazy-meadow.md — proposed ADR-024, 5 milestones on feat/passive-inputs: M1 substrate (device_connections+import_batches tables, import_observations upsert RPC, 5 metric keys recovery_score/hrv_rmssd/hrv_sdnn/resting_hr/sleep_device, seed device fixtures) → M2 Apple HAE file import (/fuentes 4th tab, Server Action upload, REAL data from Marcos's Watch S10) → M3 Whoop OAuth connector (fixture-validated; devices weeks away; env-gated "Próximamente"; first route handler /api/whoop/callback) → M4 surfacing (trends Recuperación, briefing section, check-in sleep prefill editable) → M5 E2E+ADR-024+device-arrival ritual. Marcos's decisions: Whoop weeks away → fixtures now; Apple bridge = file import; sleep prefill editable; minimal metric set (no strain/workouts). Whoop API v2 verified current (OAuth2, rotating refresh tokens, pull-only — webhooks out of scope, keeps no-service-role rule).

Last done: V2.2 plan approved and handed over; session stopped there by request (no code written).

Next: execute the V2.2 plan (fresh session, /execute against plans\vamos-a-planificar-la-lazy-meadow.md), branch feat/passive-inputs, M1 first. Still pending separately: hydration error #418 fix (TodayStatePanel.tsx).

Open questions: -

Standing (durable pointers): Supabase "athlete-os" id=zidgpigxtuzpnjvinidx (sa-east-1); G-000 HARD BAN on project "yogastasis"; 2 real users (marcosnovella99@, thomasnovella12@) + 1 e2e user + 1 demo user (demo@athleteos.app / DemoSeed2026!, disposable seed subject), siloed per D7; no service-role key stored anywhere. GitHub: MarcosNovella/athlete-os (public, main tracked). Vercel project prj_VC0NJaECdjP7UtPH96YDegesLkOe git-connected — push to main = auto prod deploy.
