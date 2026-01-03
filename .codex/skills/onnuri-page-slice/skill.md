---
name: onnuri-page-slice
description: Build exactly one page or one feature slice end-to-end with minimal scope and a clear test checklist.
metadata:
  short-description: One-slice workflow
---

## Slice rules
- Implement ONE page (route) or ONE feature slice only.
- Do not expand scope to adjacent pages/features.
- Avoid refactors outside the slice.

## Delivery checklist (every slice)
1) Route + minimal UI skeleton
2) Loading state (skeleton)
3) Error state (short message + console.error details)
4) Empty state (when applicable)
5) Data wiring (Supabase read/RPC)
6) Manual test checklist (3–7 bullets)

## Default behaviors
- Mobile-first UI
- Keep components simple and reusable
- Preserve list state via URL query params when navigating back
