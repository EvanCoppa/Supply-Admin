# Summary

<!-- What changed and why. Link issues. -->

# Test plan

<!-- How was this verified locally? Which checks did you run? -->

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:e2e` (when UI / route changes)
- [ ] Migration tested locally (when `supabase/migrations/` changes)
- [ ] `npm run db:types` re-run and committed (when schema changes)

# Risk

<!-- Blast radius. Data migrations, auth flow, billing, RLS policies all flagged here. -->

# Rollback

<!-- One sentence: how do we undo this if it goes wrong in prod. -->
