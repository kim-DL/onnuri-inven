---
name: onnuri-guardrails
description: Enforce non-negotiable project rules before writing or changing code.
metadata:
  short-description: Project safety rails
---

## Must-follow rules (hard stops)
- Never update `inventory.stock` directly. Stock changes MUST use `public.adjust_stock(...)`.
- No delete UX. Use archive: `products.active=false` + `archived_reason` required.
- List state persistence MUST use URL query params only. No localStorage.
- Do NOT implement scroll restoration.
- Search is token-based AND, and zone tokens in query override zone filter buttons.
- If a request conflicts with docs/SSOT.md or docs/CODEX_RULES.md, stop and propose a compliant alternative.

## When unsure
- Re-read: `AGENTS.md`, `docs/SSOT.md`, `docs/CODEX_RULES.md`, `docs/TODO.md`.
- Ask for the smallest missing detail only if absolutely necessary; otherwise proceed with safest assumptions.
