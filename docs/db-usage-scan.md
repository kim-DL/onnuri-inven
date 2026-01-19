# DB Usage Scan — 2026-01-19

## (1) RPC Calls

| RPC name | Arguments shape | Call site (file:line) | Expected return (fields used) | Notes |
| -------- | --------------- | --------------------- | ----------------------------- | ----- |
| get_expiry_warning_days | none | app/settings/SettingsClient.tsx:434; app/products/ProductsClient.tsx:555; app/products/[id]/ProductDetailClient.tsx:854 | number (expiry warning days) | Falls back to default when null/invalid. |
| admin_list_user_profiles | none | app/settings/SettingsClient.tsx:475,789 | array of admin user profile rows (user_id, display_name, role, active/is_active, created_at) | Used for admin staff listing; normalized via `normalizeUserProfiles`. |
| set_expiry_warning_days | { p_days: number } | app/settings/SettingsClient.tsx:538 | none (side-effect) | Client validates 1~365 before call. |
| admin_set_user_active | { p_user_id: string; p_is_active: boolean } | app/settings/SettingsClient.tsx:581 | none (side-effect) | Toggles active flag; errors mapped to UX messages. |
| admin_set_user_display_name | { p_user_id: string; p_display_name: string } | app/settings/SettingsClient.tsx:664 | none (side-effect) | Updates display name; errors mapped to UX messages. |
| restore_product | { p_product_id: string } | app/products/archived/ArchivedProductsClient.tsx:622 | none (side-effect) | Reloads archived list on success. |
| delete_product | { p_product_id: string; p_confirm_name: string } | app/products/archived/ArchivedProductsClient.tsx:691 | none (side-effect) | Admin-only; requires name confirmation. |
| get_inventory_logs_for_product | { p_product_id: string; p_limit: number } | app/products/[id]/ProductDetailClient.tsx:765,932 | array of logs (id, created_at, delta, before_stock, after_stock, actor_name, created_by, note) | Used to show recent history; `p_limit` fixed at 50. |
| update_product | { p_product_id, p_name, p_zone_id, p_manufacturer, p_unit, p_spec, p_origin_country, p_expiry_date } | app/products/[id]/ProductDetailClient.tsx:1214 | none (side-effect) | Updates core product fields from edit modal. |
| adjust_stock | { p_product_id: string; p_delta: number; p_note: string \| null } | app/products/[id]/ProductDetailClient.tsx:1308; app/products/new/page.tsx:516 | none (side-effect) | Positive delta for IN, negative for OUT; initial stock on create uses positive delta. |
| archive_product | { p_product_id: string; p_reason: string } | app/products/[id]/ProductDetailClient.tsx:1349 | none (side-effect) | Archives product with required reason. |

## (2) Table Access

| Table | Filters | Order/range/limit | Call site (file:line) | Notes |
| ----- | ------- | ----------------- | --------------------- | ----- |
| users_profile | eq user_id (session or requester) | maybeSingle | lib/auth.ts:19; app/products/ProductsClient.tsx:495; app/settings/SettingsClient.tsx:402; app/products/archived/ArchivedProductsClient.tsx:401; app/api/admin/users/route.ts:70 | Session gate + role/active checks; admin API uses service role to verify requester. |
| users_profile | upsert { user_id, role: "staff", active: true, display_name } | onConflict user_id | app/api/admin/users/route.ts:117 | Creates staff profile after auth user creation. |
| zones | eq active=true for some calls; eq id for detail lookup; no filter for lists | order(sort_order) (+ order(name) in detail); maybeSingle for eq id | app/products/[id]/ProductDetailClient.tsx:676,937,1268; app/products/ProductsClient.tsx:548; app/products/new/page.tsx:343; app/products/archived/ArchivedProductsClient.tsx:428 | Used for zone chips, detail display, and create form options. |
| products | eq active=true list; eq id & active=true detail; eq active=false archived; eq id updates; insert payload active=true | order(name); maybeSingle for detail; single for insert returning id | app/products/ProductsClient.tsx:550; app/products/[id]/ProductDetailClient.tsx:895,1093,1163; app/products/new/page.tsx:492,542; app/products/archived/ArchivedProductsClient.tsx:430 | Direct updates only touch photo_url; other field edits use RPC `update_product`. |
| inventory | eq product_id for detail; none for full list; insert with stock=0 | maybeSingle for detail; no order | app/products/[id]/ProductDetailClient.tsx:761,927; app/products/ProductsClient.tsx:554; app/products/archived/ArchivedProductsClient.tsx:434; app/products/new/page.tsx:505 | No direct updates found; creation seeds stock at 0 before RPC adjustments. |
| product-photos (storage) | upload/remove by path; eq id for product photo_url updates | n/a | app/products/[id]/ProductDetailClient.tsx:1079,1124,1152; app/products/new/page.tsx:532,556 | Supabase Storage bucket interactions for photo upload/cleanup; database writes limited to `products.photo_url`. |

### Acceptance checklist (Task A)

- [x] `.rpc(` search produced entries and is documented.
- [x] `.from(` search produced entries and is documented.
- [x] `/products/archived` retrieval approach logged with file:line reference.
- [x] Inventory direct updates not present; absence noted explicitly.

### Notes

- `/products/archived` page fetches archived items via direct select on `products` where `active=false` (app/products/archived/ArchivedProductsClient.tsx:427-434), not via RPC.
- Inventory direct updates: no `inventory.update` or `inventory_logs.insert` usages were found in the search (only inserts of zero on creation, and stock changes via `adjust_stock` RPC).

## Raw Findings

- `rg -n "\\.rpc\\(" --glob "*.ts" --glob "*.tsx"`
```
app\settings\SettingsClient.tsx:434:      const { data, error } = await supabase.rpc("get_expiry_warning_days");
app\settings\SettingsClient.tsx:475:      const { data, error } = await supabase.rpc("admin_list_user_profiles");
app\settings\SettingsClient.tsx:538:    const { error } = await supabase.rpc("set_expiry_warning_days", {
app\settings\SettingsClient.tsx:581:    const { error } = await supabase.rpc("admin_set_user_active", {
app\settings\SettingsClient.tsx:664:    const { error } = await supabase.rpc("admin_set_user_display_name", {
app\settings\SettingsClient.tsx:789:    const { data, error: listError } = await supabase.rpc(
app\products\archived\ArchivedProductsClient.tsx:622:    const { error } = await supabase.rpc("restore_product", {
app\products\archived\ArchivedProductsClient.tsx:691:    const { error } = await supabase.rpc("delete_product", {
app\products\ProductsClient.tsx:555:          supabase.rpc("get_expiry_warning_days"),
app\products\[id]\ProductDetailClient.tsx:765:      supabase.rpc("get_inventory_logs_for_product", {
app\products\[id]\ProductDetailClient.tsx:854:      const { data, error } = await supabase.rpc("get_expiry_warning_days");
app\products\[id]\ProductDetailClient.tsx:932:      const logsPromise = supabase.rpc("get_inventory_logs_for_product", {
app\products\[id]\ProductDetailClient.tsx:1214:    const { error } = await supabase.rpc("update_product", {
app\products\[id]\ProductDetailClient.tsx:1308:    const { error } = await supabase.rpc("adjust_stock", {
app\products\[id]\ProductDetailClient.tsx:1349:    const { error } = await supabase.rpc("archive_product", {
app\products\new\page.tsx:516:      const { error: adjustError } = await supabase.rpc("adjust_stock", {
```

- `rg -n "\\.from\\(" --glob "*.ts" --glob "*.tsx"`
```
lib\auth.ts:20:    .from("users_profile")
app\settings\SettingsClient.tsx:402:        .from("users_profile")
app\products\ProductsClient.tsx:411:  const { data } = supabase.storage.from("product-photos").getPublicUrl(photoRef);
app\products\ProductsClient.tsx:495:        .from("users_profile")
app\products\ProductsClient.tsx:548:          supabase.from("zones").select("id, name").order("sort_order"),
app\products\ProductsClient.tsx:550:            .from("products")
app\products\ProductsClient.tsx:554:          supabase.from("inventory").select("product_id, stock"),
app\api\admin\users\route.ts:70:    .from("users_profile")
app\api\admin\users\route.ts:117:    .from("users_profile")
app\products\new\page.tsx:344:        .from("zones")
app\products\new\page.tsx:492:      .from("products")
app\products\new\page.tsx:505:      .from("inventory")
app\products\new\page.tsx:532:        .from("product-photos")
app\products\new\page.tsx:543:          .from("products")
app\products\new\page.tsx:556:            .from("product-photos")
app\products\archived\ArchivedProductsClient.tsx:402:        .from("users_profile")
app\products\archived\ArchivedProductsClient.tsx:428:      supabase.from("zones").select("id, name").order("sort_order"),
app\products\archived\ArchivedProductsClient.tsx:430:        .from("products")
app\products\archived\ArchivedProductsClient.tsx:434:      supabase.from("inventory").select("product_id, stock"),
app\products\[id]\ProductDetailClient.tsx:554:  const { data } = supabase.storage.from("product-photos").getPublicUrl(photoRef);
app\products\[id]\ProductDetailClient.tsx:677:      .from("zones")
app\products\[id]\ProductDetailClient.tsx:761:        .from("inventory")
app\products\[id]\ProductDetailClient.tsx:896:        .from("products")
app\products\[id]\ProductDetailClient.tsx:927:        .from("inventory")
app\products\[id]\ProductDetailClient.tsx:939:          .from("zones")
app\products\[id]\ProductDetailClient.tsx:1080:      .from("product-photos")
app\products\[id]\ProductDetailClient.tsx:1094:      .from("products")
app\products\[id]\ProductDetailClient.tsx:1107:        .from("product-photos")
app\products\[id]\ProductDetailClient.tsx:1125:        .from("product-photos")
app\products\[id]\ProductDetailClient.tsx:1153:        .from("product-photos")
app\products\[id]\ProductDetailClient.tsx:1164:      .from("products")
app\products\[id]\ProductDetailClient.tsx:1268:        .from("zones")
```

- `rg -n "(archived|list_archived_products|active\\s*=\\s*false|eq\\('active')" --glob "*.ts" --glob "*.tsx"`
```
app\products\ProductsClient.tsx:650:  const archivedHref = detailQuery
app\products\ProductsClient.tsx:651:    ? `/products/archived?${detailQuery}`
app\products\ProductsClient.tsx:652:    : "/products/archived";
app\products\ProductsClient.tsx:832:                        href={archivedHref}
app\products\archived\ArchivedProductsClient.tsx:442:        console.error("Failed to fetch archived products", productsResult.error);
app\products\archived\ArchivedProductsClient.tsx:638:      } else if (message.includes("not archived")) {
app\products\archived\ArchivedProductsClient.tsx:712:      } else if (message.includes("not archived")) {
```

- `rg -n "(from\\('inventory'\\)\\.update|update\\('inventory'|inventory_logs.*insert|inventory\\.update)" --glob "*.ts" --glob "*.tsx"`
```
(no matches)
```
