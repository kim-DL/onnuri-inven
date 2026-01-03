---
name: onnuri-ui-system
description: Apply the app’s UI system consistently (mobile-first, #F9F8F6 background, simple cards, clear actions).
metadata:
  short-description: UI system rules
---

## Global UI tokens
- Background: `#F9F8F6` (every page)
- Mobile-first layout
- Touch targets >= 44px
- Minimal decoration; avoid heavy animation

## Layout pattern
- TopBar + content + (optional) bottom fixed action
- List items are full-card tappable
- Stock numbers are large and prominent

## States
- Loading: skeleton
- Empty: clear message + reset action if relevant
- Error: short message + console.error details

## Component set (preferred)
- TopBar
- FilterChips
- SearchInput
- ProductCard / CardList
- Modal
- Toast
- Skeleton
