# State
Goal: MVP "Readiness Loop" — capture (check-in + sessions) → deterministic engine → dashboards → AI coach. Full design: C:\Users\Marcos\.claude\plans\quiero-que-trabajemos-juntos-pure-hammock.md
Last done: substrate schema SHIPPED — 2 migrations authored (file-first) AND applied to cloud (subjects, metrics registry seeded w/ 14 MVP metrics, observations spine, daily_checkins, training_sessions, insights; RLS owner-model on all; security advisor: 0 findings). database.types.ts generated; typed clients; verify GREEN; commits 9838034 (scaffold) + 77a0ac6 (schema).
Next: auth flow + subject onboarding (2 users), then capture UX (check-in + session forms) with the app-layer emission service (entity + observations in one transaction, ADR-011).
Supabase: CLOUD project "athlete-os" id=zidgpigxtuzpnjvinidx (org MarcosNovella, sa-east-1, free tier). HARD BAN per G-000: never touch project "yogastasis".
Open questions: .env.local blocked until Marcos updates ~/.claude/hooks/guard.mjs (removes stale .env write-deny; R3 now delegates .env to agent).
