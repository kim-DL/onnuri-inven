# Skill: onnuri-page-slice

This skill enforces “one slice at a time” delivery.

## What counts as a slice
A slice is ONE of the following:
- one page route (e.g. `/products/[id]`)
- one user-visible feature within a single page (e.g. “IME-safe search URL persistence”)

Do not bundle multiple pages, refactors, or unrelated cleanup in a single slice.

## Scope limits
- Change the minimum number of files required.
- Do not rename folders, restructure app layout, or reformat the whole file.
- Do not introduce new dependencies unless SSOT explicitly requires it.

## Required output format (in your completion message)
1) What changed (1–3 short bullets)
2) Files changed (list)
3) How to test locally (exact commands)
4) Manual test checklist (bullet list)
5) Known limitations (if any)

## Implementation preferences (Next.js App Router)
- Prefer simple client components only where needed.
- Avoid unnecessary navigation churn.
- Keep state persistence in the URL (per guardrails).
- Keep the UI mobile-first and consistent with the UI system skill.

## Quality gates
- Must pass `npm run lint`.
- No direct writes to inventory.
- No localStorage list-state persistence.
- Avoid IME-breaking patterns (router updates per keystroke).
