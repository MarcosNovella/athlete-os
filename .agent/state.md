# State
Goal: MVP "Readiness Loop" — capture (check-in + sessions) → deterministic engine → dashboards → AI coach. Full design: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md
Last done: CAPTURE VERTICAL SLICE shipped + E2E-verified (Playwright headless, mobile viewport): auth (login-only app) + proxy session gate + onboarding + check-in/session tap-first forms + atomic save/re-emit RPCs (migration 3) + spine emission CONFIRMED in DB (8 emitted obs, correct values/linkage). verify GREEN (15 tests). 3 migrations file-first & applied.
Next: deterministic engine (modules/fitness/engine): EWMA 7d/28d, ACWR bands-as-flags, monotony/strain, 28d baselines + z-flags, progressive-unlock gating (ADR-012) → then dashboards ("today state" reward panel first).
Supabase: CLOUD project "athlete-os" id=zidgpigxtuzpnjvinidx (org MarcosNovella, sa-east-1, free tier). HARD BAN per G-000: never touch project "yogastasis".
E2E user for future browser tests: marcosnovella99+e2e@gmail.com / e2e-Password-123 (subject "E2E Tester", own silo — does not pollute real data; delete anytime via auth.users cascade).
Real accounts CREATED + login-verified (2026-07-01): marcosnovella99@gmail.com and thomasnovella12@gmail.com (SQL-seeded into auth.users — Supabase built-in mailer rate limit blocks signUp API; passwords known to the owners, NOT stored here). No public signup by design.
Open questions: -
