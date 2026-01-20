# Today Report - Expiry Warning Cache

## Context
- Goal: `get_expiry_warning_days` fetch must be once per session in production, with a single refetch only after settings save.
- Scope: Front-end cache/hook + call sites + report.

## Root Cause
- Module-scope cache was not shared across route chunks, so navigation created duplicate module instances and duplicate RPC calls.
- Mixed import paths increased the chance of multiple module copies.

## Fix Approach
- Use a `globalThis`-backed cache that stores the value, shared in-flight promise, last error, and listeners.
- Only fetch on first mount when the global cache is empty; no implicit refetch on navigation.
- Settings save calls explicit `refetch()`; all call sites use a single canonical import path.
- Surface a short inline error message when the RPC fails, while logging details to console.

## Files Changed
- `lib/useExpiryWarningDays.ts`: move cache to `globalThis`, share promise/listeners, prevent auto-refetch.
- `app/products/ProductsClient.tsx`: normalize import path and show minimal error message.
- `app/products/[id]/ProductDetailClient.tsx`: use shared hook and show minimal error message.
- `app/settings/SettingsClient.tsx`: use shared hook and explicit refetch after save (already in baseline).

## Verification (prod-mode)
- Build: PASS (`npm run build`).
- Start: PASS (`npm run start` -> Ready; process ended due to CLI timeout).
- RPC fetch count criteria: FAIL (manual Network verification not run in CLI).
  - 1) Hard reload /products: NOT VERIFIED (needs browser DevTools).
  - 2) Repeated navigation /products -> /products/[id] -> /settings: NOT VERIFIED.
  - 3) After saving settings: NOT VERIFIED.

## Follow-ups
- Run the three Network checks in a real browser session to confirm fetch counts.
- Optionally reset the global cache on sign-out if a hard reset is required between sessions.
