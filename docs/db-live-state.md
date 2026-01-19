# DB Live State — 2026-01-19

## Status

Blocked: live Supabase SQL access is not available from this environment. Attempts to query metadata via PostgREST with the service role key returned 404/406, and `psql` is not installed/configured because no Postgres connection string or password is provided.

## Attempts

- Tried PostgREST access to `pg_policies` with service role credentials: `Invoke-RestMethod .../rest/v1/pg_policies?...` → 404.
- Tried PostgREST with `Accept-Profile=pg_catalog` to reach `pg_policies` → 406.
- Tried PostgREST path `pg_catalog.pg_policies` → 404.
- Tried PostgREST `pg_meta/tables` probe → PGRST125 invalid path.
- `psql --version` shows client not installed; even if present, DB password/connection info is not available.

## Acceptance checklist (Task B)

- [ ] RLS policy query output captured for target tables.
- [ ] Function definitions captured (`adjust_stock`, `is_admin`, `is_active_user`, etc.).
- [ ] Index list captured for products/inventory/inventory_logs.

Next step to unblock: provide Supabase SQL Editor access or a Postgres connection string (host, user, password) so the required queries can be executed.
