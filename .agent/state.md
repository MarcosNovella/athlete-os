# State
Goal: MVP "Readiness Loop" — v1 FEATURE-COMPLETE; now in real-usage phase. DoD gate: capture habit 4+ weeks (both users). Design memo: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md

Log:
- 2026-07-01 Session 1: scaffold → substrate → capture → engine → dashboards → $0 AI coach. All verify-GREEN (49 tests) + E2E across 3 tabs. Decisions ADR-001..016; guardrails G-000..004. Full episode: journal.md.
- 2026-07-01 Session 2: PWA + offline queue (last D12 gap) — manifest+icons, hand-rolled sw.js, IndexedDB queue + <OfflineSync/> replay (ADR-017); guardrail G-005. verify GREEN (53 tests) + offline E2E 8/8 on prod build. THEN Vercel production deploy (ADR-018): LIVE at https://athlete-os-pink.vercel.app — prod smoke 4/4 (public login, PWA plumbing, Supabase+RLS, SW active).

Last done: Vercel prod deploy smoke-tested live. Vercel CLI logged in as marcosnovella (device flow); project marcosnovellas-projects/athlete-os. e2e user password rotated via SQL (throwaway).

Next: (a) install PWA on both phones (Thomas needs his password — SQL-seeded, may need a reset); (b) first real /coach run once ~1wk of data exists; (c) synthesis reminder automation; (d) optional: git remote + Vercel git integration, custom domain. DoD gate unchanged: 4-week capture habit.

Open questions: -

Standing (durable pointers): Supabase "athlete-os" id=zidgpigxtuzpnjvinidx (sa-east-1); G-000 HARD BAN on project "yogastasis"; 2 real users (marcosnovella99@, thomasnovella12@) + 1 e2e user, siloed per D7; no service-role key stored anywhere.
