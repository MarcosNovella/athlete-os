# State
Goal: MVP "Readiness Loop" — v1 FEATURE-COMPLETE; now in real-usage phase. DoD gate: capture habit 4+ weeks (both users). Design memo: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md

Log:
- 2026-07-01 Session 1: scaffold → substrate → capture → engine → dashboards → $0 AI coach. All verify-GREEN (49 tests) + E2E across 3 tabs. Decisions ADR-001..016; guardrails G-000..004. Full episode: journal.md.
- 2026-07-01 Session 2: PWA + offline queue (last D12 gap) — manifest+icons, hand-rolled sw.js, IndexedDB queue + <OfflineSync/> replay (ADR-017); guardrail G-005. verify GREEN (53 tests) + offline E2E 8/8 on prod build.

Last done: Session 2 PWA/offline shipped & committed. e2e user password rotated via SQL (throwaway).

Next: pick one: (a) Vercel deploy for brother's phone (now unblocked as full PWA); (b) first real /coach run once ~1wk of data exists; (c) synthesis reminder automation. Meanwhile the real test is daily capture by both users.

Open questions: -

Standing (durable pointers): Supabase "athlete-os" id=zidgpigxtuzpnjvinidx (sa-east-1); G-000 HARD BAN on project "yogastasis"; 2 real users (marcosnovella99@, thomasnovella12@) + 1 e2e user, siloed per D7; no service-role key stored anywhere.
