# Code Review Report

- Date: 2026-02-11
- Branch: main
- Scope: `app/**`, `lib/**`, `db/patches/**`
- Validation run: `npm run lint` (pass), `npm run build` (pass)

## Findings (By Severity)

### 1. [High] Photo update path does not invalidate products-list cache
- Evidence: `app/products/[id]/ProductDetailClient.tsx:1375`, `app/products/[id]/ProductDetailClient.tsx:1444`, `app/products/[id]/ProductDetailClient.tsx:1507`, `lib/useProductsListData.ts:53`
- Detail: The "photo change" success path sets local detail state but does not call `invalidateProductsListDataCache()`. The "photo delete" path does invalidate. With list cache TTL at 60s, `/products` re-entry can show stale thumbnail after a photo replacement.
- Impact: Users can confirm photo change in detail view but still see old image in list view for up to cache TTL.
- Recommendation: Call `invalidateProductsListDataCache()` immediately after successful `photo_url` update in `handlePhotoFileChange`.

### 2. [Medium] Photo delete flow can leave dangling DB reference on partial failure
- Evidence: `app/products/[id]/ProductDetailClient.tsx:1478`, `app/products/[id]/ProductDetailClient.tsx:1489`
- Detail: Current order is Storage remove first, then DB `photo_url = null`. If DB update fails after Storage deletion, DB still points to a removed object.
- Impact: Broken image references persist in DB and are difficult to recover automatically.
- Recommendation: Prefer DB pointer clear first, then best-effort Storage cleanup; or implement compensating rollback if DB update fails.

### 3. [Medium] New product creation is non-atomic (product row may exist without inventory row)
- Evidence: `app/products/new/page.tsx:581`, `app/products/new/page.tsx:595`, `app/products/new/page.tsx:597`, `app/products/new/page.tsx:601`
- Detail: Product insert succeeds, then inventory insert can fail and the flow returns with error without rollback.
- Impact: Orphan products (without inventory row) can break follow-up operations (for example stock adjust path expects inventory row).
- Recommendation: Move creation into one transactional RPC (product + inventory seed), or rollback product insert on inventory failure.

### 4. [Medium] Absolute stock adjust has race window under concurrent updates
- Evidence: `app/products/[id]/ProductDetailClient.tsx:1611`, `app/products/[id]/ProductDetailClient.tsx:1649`, `app/products/[id]/ProductDetailClient.tsx:1659`, `app/products/[id]/ProductDetailClient.tsx:1663`
- Detail: "Adjust" mode reads current stock, computes delta client-side, then calls `adjust_stock`. If another adjustment occurs between read and RPC call, final stock may differ from intended absolute target.
- Impact: In multi-user operation, "set to X" can produce unexpected final stock.
- Recommendation: Add a server-side RPC for absolute set (single transaction with row lock), and call that from adjust mode.

### 5. [Low] Debounced search can drop latest input on quick blur
- Evidence: `app/products/ProductsClient.tsx:584`, `app/products/ProductsClient.tsx:729`, `app/products/ProductsClient.tsx:738`, `app/products/ProductsClient.tsx:774`, `app/products/archived/ArchivedProductsClient.tsx:488`, `app/products/archived/ArchivedProductsClient.tsx:555`, `app/products/archived/ArchivedProductsClient.tsx:564`, `app/products/archived/ArchivedProductsClient.tsx:600`
- Detail: While editing, query is committed by debounce. If input blurs before debounce fires, `isEditing` flips false and input value snaps back to committed URL query, potentially discarding the latest keystrokes.
- Impact: Intermittent perceived input loss, especially on mobile tap-out flows.
- Recommendation: Commit pending draft on blur when not composing, before toggling editing state.

## Open Questions / Assumptions
- Assumed expected behavior is "photo changed in detail should reflect immediately on list re-entry" (as described in current project tasks).
- DB-level transactional guarantees for product creation are not present in current client flow; this report treats that as a data-integrity risk.

## Additional Checks (No Finding)
- No direct client-side `inventory.stock` update path found; stock mutations go through `adjust_stock` RPC.
- No `localStorage`-based list state persistence found.
- No scroll restoration implementation found.
- Zone/Search/IME logic patterns in products lists are present and generally aligned with SSOT rules.
