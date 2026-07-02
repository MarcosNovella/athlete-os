# State
Goal: MVP "Readiness Loop" — v1 FEATURE-COMPLETE; now in real-usage phase. DoD gate: capture habit 4+ weeks (both users). Design memo: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md

Log:
- 2026-07-01 Session 1: scaffold → substrate → capture → engine → dashboards → $0 AI coach. All verify-GREEN (49 tests) + E2E across 3 tabs. Decisions ADR-001..016; guardrails G-000..004. Full episode: journal.md.
- 2026-07-01 Session 2: PWA + offline queue (last D12 gap) — manifest+icons, hand-rolled sw.js, IndexedDB queue + <OfflineSync/> replay (ADR-017); guardrail G-005. verify GREEN (53 tests) + offline E2E 8/8 on prod build. THEN Vercel production deploy (ADR-018): LIVE at https://athlete-os-pink.vercel.app — prod smoke 4/4 (public login, PWA plumbing, Supabase+RLS, SW active).

- 2026-07-02 Session 3: visual redesign (ADR-019 "vestuario antes del amanecer") — tokens/@theme, Barlow (Condensed) + mono, pulse signature mark, all screens + charts + icons reskinned, sw v2; guardrail G-006 (PS mojibake). verify GREEN (53) + offline E2E 8/8 on prod build. App installed on BOTH phones; Thomas logged in (DoD clock running).

- 2026-07-02 Session 4: test-data SEED (ADR-020) — scripts/seed.ts + `pnpm seed` (`-- --dry-run` previews the real computeSnapshot). 28-day narrative (21d baseline → 7d overreaching) on a DISPOSABLE demo subject (demo@athleteos.app), reusing emission.ts + save_* RPCs via anon key (no service-role). Demo auth user created by hand via MCP SQL → guardrail G-007 (GoTrue 500 until token cols set to ''). Loaded 28 checkins / 23 sessions / 209 obs; RE-RUN idempotent (same counts, 0 dupe groups). In-app (dev) confirms all unlocks open + all 3 flags fire (ACWR 1.55 alta, readiness z-2.78, monotony 38.39). verify GREEN (53).

- 2026-07-02 Session 5: ran /coach against the demo subject (28d seeded history) — deterministic briefing via `pnpm briefing`, wrote back 1 weekly_synthesis + 1 hypothesis, confirmed both render in the Coach tab. Found + fixed a pre-existing mojibake bug (G-006 residue) in coach/page.tsx + OnboardingForm.tsx while testing. Merged feat/test-data-seed -> main (ff), then git+Vercel setup (ADR-021): created GitHub repo MarcosNovella/athlete-os, pushed main + feature branch, connected the existing Vercel project to it via the dashboard (git-app OAuth step the MCP can't do headlessly). Push-to-deploy is now live for main; other branches get previews.

Last done: repo on GitHub + Vercel git integration connected and confirmed by Marcos; MVP fully demonstrable end-to-end (seed -> engine -> coach) and now ships via git push instead of manual `vercel deploy`.

Next: (a) first real /coach run once ~1wk of real data; (b) synthesis reminder automation; (c) optional: custom domain. DoD gate unchanged: 4-week capture habit (REAL users only — demo data excluded).

Open questions: -

Standing (durable pointers): Supabase "athlete-os" id=zidgpigxtuzpnjvinidx (sa-east-1); G-000 HARD BAN on project "yogastasis"; 2 real users (marcosnovella99@, thomasnovella12@) + 1 e2e user + 1 demo user (demo@athleteos.app / DemoSeed2026!, disposable seed subject), siloed per D7; no service-role key stored anywhere. GitHub: MarcosNovella/athlete-os (public, main tracked). Vercel project prj_VC0NJaECdjP7UtPH96YDegesLkOe now git-connected — push to main = auto prod deploy.
