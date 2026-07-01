# State
Goal: MVP "Readiness Loop" — capture (check-in + sessions) → deterministic engine → dashboards → AI coach. Full design: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md
Last done: DASHBOARDS shipped (ADR-015): /trends page with server-rendered SVG charts (zero deps) — 28d load bars + acute/chronic EWMA lines, sleep & readiness trend charts w/ personal-mean overlay + visual gaps, Monday-start weekly summary table; TabNav Hoy|Tendencias. computeTrends pure+tested. verify GREEN (46 tests) + E2E PASS (charts + weekly table assert).
Next: AI COACH phase (ADR-009/D8): (1) on-demand Q&A server action grounded in EngineSnapshot+trends with cited metrics, Claude via server-side SDK + Langfuse logging; (2) weekly synthesis Vercel Cron -> insights table (labeled hypotheses). Needs: ANTHROPIC_API_KEY (+ Langfuse keys) from Marcos; add anthropic SDK dep.
Supabase: CLOUD project "athlete-os" id=zidgpigxtuzpnjvinidx (org MarcosNovella, sa-east-1, free tier). HARD BAN per G-000: never touch project "yogastasis".
E2E user for future browser tests: marcosnovella99+e2e@gmail.com / e2e-Password-123 (subject "E2E Tester", own silo — does not pollute real data; delete anytime via auth.users cascade).
Real accounts CREATED + login-verified (2026-07-01): marcosnovella99@gmail.com and thomasnovella12@gmail.com (SQL-seeded into auth.users — Supabase built-in mailer rate limit blocks signUp API; passwords known to the owners, NOT stored here). No public signup by design.
Open questions: -
