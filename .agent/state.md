# State
Goal: MVP "Readiness Loop" — capture (check-in + sessions) → deterministic engine → dashboards → AI coach. Full design: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md
Last done: scaffold complete, `pnpm verify` GREEN; G-001 added (biome migrate silently disabled lints — caught & fixed, noExplicitAny hardened to error); git init (main), initial commit pending Marcos's OK.
Next: substrate schema migration (Metric registry + Observation spine + DailyCheckIn + TrainingSession + Insight, RLS-first per D6/D7/D10).
Supabase: CLOUD project "athlete-os" id=zidgpigxtuzpnjvinidx (org MarcosNovella, sa-east-1, free tier). HARD BAN per G-000: never touch project "yogastasis".
Open questions: .env.local blocked until Marcos updates ~/.claude/hooks/guard.mjs (removes stale .env write-deny; R3 now delegates .env to agent).
