# Product Photo Cache Policy

## Scope
- Product list page: `app/products/ProductsClient.tsx`
- Product detail page: `app/products/[id]/ProductDetailClient.tsx`
- Product create page: `app/products/new/page.tsx`
- Shared photo utilities: `lib/productPhoto.ts`

## URL and cache behavior
- `photo_url` is rendered with `resolveProductPhotoUrl(...)`.
- If `photo_url` is already an absolute URL, it is used as-is.
- If `photo_url` is a storage path, it is converted to a public URL from `product-photos`.
- List and detail image tags use `loading="lazy"` and rely on browser HTTP cache.

## Upload cache policy
- Uploads to `product-photos` set `cacheControl: "31536000"` (1 year).
- This is safe because uploaded paths are immutable UUID-based paths.

## Photo update behavior
- New/updated photo paths are built by `buildProductPhotoPath(productId, file)`.
- The path format is `products/<product_id>/<uuid>.<ext>`.
- Changing a photo always creates a new path and a new URL.
- Because the URL changes, browser cache for the old URL is bypassed automatically.

## Failure and fallback behavior
- If image loading fails, existing fallback UI remains:
  - list: hide failed `<img>` and keep placeholder visible
  - detail: mark failed `photoSrc` and keep placeholder visible
- Product detail stale-guard remains unchanged: `product?.id === productId`.
