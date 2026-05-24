# Runbook: Credential Rotation

**Audience:** Admin operators / platform engineering
**When to use:** Scheduled quarterly rotation, suspected compromise, employee departure, or an external partner reports their stored credential is invalid.

## Inventory of secrets

| Secret                                | Where it lives                                          | Who consumes it                                  |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`           | `.env` (server), Vercel project env                     | Admin SSR routes that bypass RLS                 |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY`     | `.env`, Vercel public env                               | Browser + SSR (read-only with RLS)               |
| Per-customer API tokens (`api_tokens`)| Hashed in `public.api_tokens.token_hash`                | External integrations (Guaranteeth, etc.)        |
| Gemini API key (`GEMINI_API_KEY`)     | `.env` (server only)                                    | `/image-generator` route                         |
| Payment gateway credentials           | Vercel env (gateway-specific)                           | `/api/v1/admin/orders/:id/refund` server caller  |
| GitHub deploy key / Vercel token      | Vercel + GitHub settings                                | CI/CD                                            |

## Rotation procedures

### 1. Supabase service role key

1. In Supabase Studio → **Project settings → API**, click **Generate new service role secret**.
2. Update the secret in Vercel: `vercel env rm SUPABASE_SERVICE_ROLE_KEY production && vercel env add SUPABASE_SERVICE_ROLE_KEY production` (paste new value).
3. Trigger a redeploy: `vercel deploy --prod` (or merge a no-op commit to `main`).
4. Verify by hitting an admin-only route (e.g., `/admin-users`) — a 500 with `srv_*` code in the UI banner means the new key is invalid; roll back the env value to the previous key in Vercel and investigate.
5. Update local `.env` for every active developer.
6. Revoke the previous key in Supabase Studio **after** all environments are confirmed working.

### 2. Supabase publishable key

Same flow as service role, but the key is also read in the browser. Hard refresh in an incognito window to verify the new key is being served.

### 3. Per-customer API tokens (`api_tokens`)

Used by external partners hitting `/api/v1/*`. Each customer's tokens are managed under `/clients/<id>/tokens`.

1. Open `/clients/<customer-id>/tokens`.
2. Click **Create token**, copy the plaintext value once (it is not retrievable afterward).
3. Hand the new token to the partner via your secure channel (1Password share, etc.).
4. Confirm the partner has rolled the new token into their config and run one end-to-end call.
5. Click **Revoke** on the old token row. The hash is removed; subsequent requests with the old token will 401.

For bulk rotation (e.g., quarterly), iterate per-customer rather than mass-revoking — coordinated revoke without a partner handoff causes downtime for that integration.

### 4. Gemini API key (`GEMINI_API_KEY`)

1. Generate a new key in Google AI Studio.
2. Update Vercel env, redeploy.
3. Test by submitting a small image at `/image-generator`. A failure surfaces in the page form banner.
4. Delete the old key in Google AI Studio.

### 5. Payment gateway credentials

Coordinate with finance — refund attempts during rotation may queue or fail.

1. Provision new credentials in the gateway dashboard with the same permission scope.
2. Update Vercel env vars, redeploy.
3. Run a $0.01 test refund against a sandbox order, or verify a non-financial endpoint the SDK exposes.
4. Revoke the old credential after a 24h soak.

### 6. CI/CD secrets (GitHub + Vercel)

1. Rotate the Vercel token in `https://vercel.com/account/tokens` and update the GitHub repo secret `VERCEL_TOKEN`.
2. Re-run the latest `main` workflow to confirm CI still passes.
3. If using a GitHub deploy key, regenerate via `ssh-keygen -t ed25519`, update Vercel's Git settings, remove the old key.

## After every rotation

- Record the rotation in a shared log (date, secret name, operator, ticket).
- If the rotation was reactive (suspected leak), schedule a 7-day follow-up review of access logs (`get_logs` MCP tool against the affected Supabase project, or the gateway's audit log).
- Verify all alerting destinations (Sentry, PagerDuty if wired) still receive events — a stale webhook secret will silently swallow alerts.

## Escalation

Page on-call platform engineering if:
- A rotation breaks production and the previous secret is unrecoverable.
- An external partner reports their token still works **after** you revoked it (indicates cache or stale row).
- Any rotation produces a 5xx storm in `/api/v1/*` — immediately roll back the env change in Vercel.
