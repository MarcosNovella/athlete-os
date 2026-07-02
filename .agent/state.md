# State
Goal: MVP "Readiness Loop" — v1 FEATURE-COMPLETE; now in real-usage phase. DoD gate: capture habit 4+ weeks (both users). Design memo: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md

Log:
- 2026-07-01 Session 1: scaffold → substrate → capture → engine → dashboards → $0 AI coach. All verify-GREEN (49 tests) + E2E across 3 tabs. Decisions ADR-001..016; guardrails G-000..004. Full episode: journal.md.
- 2026-07-01 Session 2: PWA + offline queue (last D12 gap) — manifest+icons, hand-rolled sw.js, IndexedDB queue + <OfflineSync/> replay (ADR-017); guardrail G-005. verify GREEN (53 tests) + offline E2E 8/8 on prod build. THEN Vercel production deploy (ADR-018): LIVE at https://athlete-os-pink.vercel.app — prod smoke 4/4 (public login, PWA plumbing, Supabase+RLS, SW active).

- 2026-07-02 Session 3: visual redesign (ADR-019 "vestuario antes del amanecer") — tokens/@theme, Barlow (Condensed) + mono, pulse signature mark, all screens + charts + icons reskinned, sw v2; guardrail G-006 (PS mojibake). verify GREEN (53) + offline E2E 8/8 on prod build. App installed on BOTH phones; Thomas logged in (DoD clock running).

- 2026-07-02 Session 4: test-data SEED (ADR-020) — scripts/seed.ts + `pnpm seed` (`-- --dry-run` previews the real computeSnapshot). 28-day narrative (21d baseline → 7d overreaching) on a DISPOSABLE demo subject (demo@athleteos.app), reusing emission.ts + save_* RPCs via anon key (no service-role). Demo auth user created by hand via MCP SQL → guardrail G-007 (GoTrue 500 until token cols set to ''). Loaded 28 checkins / 23 sessions / 209 obs; RE-RUN idempotent (same counts, 0 dupe groups). In-app (dev) confirms all unlocks open + all 3 flags fire (ACWR 1.55 alta, readiness z-2.78, monotony 38.39). verify GREEN (53).

Last done: demo subject fully seeded + validated in-app; MVP now demonstrable end-to-end without waiting for real history. (Cosmetic: monotony=38 is exaggerated — loads too clustered; fine for demo, could add jitter if realism matters.)

Next: (a) run /coach against the demo subject to exercise the weekly-synthesis path end-to-end; (b) first real /coach run once ~1wk of real data; (c) synthesis reminder automation; (d) optional: git remote + Vercel git integration, custom domain. DoD gate unchanged: 4-week capture habit (REAL users only — demo data excluded).

Open questions: -

Standing (durable pointers): Supabase "athlete-os" id=zidgpigxtuzpnjvinidx (sa-east-1); G-000 HARD BAN on project "yogastasis"; 2 real users (marcosnovella99@, thomasnovella12@) + 1 e2e user + 1 demo user (demo@athleteos.app / DemoSeed2026!, disposable seed subject), siloed per D7; no service-role key stored anywhere.
