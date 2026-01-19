## Project Overview
- Project name: 온누리 재고조사 웹앱
- Tech stack: Next.js (App Router), Supabase, Vercel
- Deployment status: already deployed (Vercel)
- Target usage: mobile-first internal inventory counting app

## Repository Structure (Repo Map)
```text
.
|-- app/
|   |-- api/
|   |   `-- admin/
|   |       `-- users/
|   |           `-- route.ts
|   |-- login/
|   |   |-- LoginClient.tsx
|   |   `-- page.tsx
|   |-- products/
|   |   |-- archived/
|   |   |   |-- ArchivedProductsClient.tsx
|   |   |   `-- page.tsx
|   |   |-- new/
|   |   |   `-- page.tsx
|   |   |-- [id]/
|   |   |   |-- ProductDetailClient.tsx
|   |   |   `-- page.tsx
|   |   |-- ProductsClient.tsx
|   |   `-- page.tsx
|   |-- settings/
|   |   |-- SettingsClient.tsx
|   |   `-- page.tsx
|   |-- favicon.ico
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- db/
|   `-- patches/
|       `-- 2026-01-05_fix_admin_user_rpcs_active.sql
|-- docs/
|   |-- CODEX_RULES.md
|   |-- PRD.md
|   |-- SSOT.md
|   |-- TODO.md
|   `-- chatgptreport.md
|-- lib/
|   |-- auth.ts
|   |-- resizeImageForUpload.ts
|   |-- search.ts
|   `-- supabaseClient.ts
|-- public/
|   |-- file.svg
|   |-- globe.svg
|   |-- next.svg
|   |-- vercel.svg
|   `-- window.svg
|-- .env.local
|-- .gitignore
|-- eslint.config.mjs
|-- next-env.d.ts
|-- next.config.ts
|-- package-lock.json
|-- package.json
|-- postcss.config.mjs
|-- README.md
`-- tsconfig.json
```
- Omitted from tree: .codex, .git, .next, node_modules

## Key Functional Areas (High-level)
- Authentication & user gating (Supabase auth + users_profile)
- Products list page (/products)
- Product detail page (/products/[id])
- Product create page (/products/new)
- Stock adjustment via RPC (adjust_stock)
- Image upload & client-side resize (browser-image-compression based)
- Storage usage (product-photos bucket, public read)

## Image Upload & Resize Summary
- Purpose: reduce Supabase storage & egress usage (Free plan)
- Location of resize logic: lib/resizeImageForUpload.ts
- Policy summary:
  - Client-side resize before upload
  - Orientation handled by library (no manual EXIF parsing)
  - Fallback to original file if resize fails
  - Same logic used for create & edit flows
- Storage path convention:
  - product-photos/products/<product_id>/<uuid>.jpg
  - Typical output size observed in production: ~50–100 KB per image


## Database Overview (Conceptual)
- Tables:
  - products
  - inventory
  - inventory_logs
  - zones
  - users_profile
  - app_settings
- Notes:
  - inventory is 1:1 with products
  - inventory_logs is append-only
  - products.photo_url stores storage object path (not full URL)
  - Hard delete is admin-only and intended to sync with DB delete

## Deployment & Workflow Notes
- GitHub used as source of truth
- Vercel handles preview & production deployments
- Untracked files like docs/chatgptreport.md are intentionally NOT committed unless explicitly decided
- This report exists to help future AI sessions maintain continuity

## Current Status Summary
- Image resize v2 implemented and deployed
- Supabase storage shows resized images (~tens of KB)
- Build passes locally and on Vercel
- System is in QA / stabilization phase
