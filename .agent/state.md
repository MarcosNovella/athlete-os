# State
Goal: MVP "Readiness Loop" — capture (check-in + sessions) → deterministic engine → dashboards → AI coach. Full design: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md
Last done: DETERMINISTIC ENGINE shipped (ADR-012/014): pure tested modules (daily-load series w/ real zeros, EWMA 7/28, ACWR flags, Foster monotony/strain, 28d baselines + z, readiness-drop flag) + progressive-unlock gating + "Estado de hoy" RSC panel on the today page. Compute-on-read, 90d window. verify GREEN (40 tests) + E2E PASS incl. panel (day-1 cold-start shows 5 locks w/ countdowns). Real users created earlier & login-verified.
Next: dashboards phase — history/trends views (load & ACWR chart, sleep/readiness trends, weekly overview) reading the spine; then AI coach (on-demand Q&A grounded in EngineSnapshot + weekly synthesis via Vercel Cron, ADR-009).
Supabase: CLOUD project "athlete-os" id=zidgpigxtuzpnjvinidx (org MarcosNovella, sa-east-1, free tier). HARD BAN per G-000: never touch project "yogastasis".
E2E user for future browser tests: marcosnovella99+e2e@gmail.com / e2e-Password-123 (subject "E2E Tester", own silo — does not pollute real data; delete anytime via auth.users cascade).
Real accounts CREATED + login-verified (2026-07-01): marcosnovella99@gmail.com and thomasnovella12@gmail.com (SQL-seeded into auth.users — Supabase built-in mailer rate limit blocks signUp API; passwords known to the owners, NOT stored here). No public signup by design.
Open questions: -
