# Nonfunctional Acceptance Evidence (#25, NF1–NF10)

Prepared by Jessie (Designer) on 2026-11-25 against `main` @ a7ce41f (after PR #79 and #80).
Environment: local Vite dev server (localhost:5173) with Firebase emulators, signed in as a seeded test user; production checks use https://info442-husky-share.web.app.

## Summary

| ID | Requirement | Result | Evidence |
|---|---|---|---|
| NF1 | Map loads with up to 200 markers within 3 s | PASS | Local: 238 active listings, data load 34–73 ms (Sprint 2 report). Production cold load of `/map`: DOMContentLoaded 518 ms, load 564 ms. |
| NF2 | Search results within 1 s | PASS | Client-side filter, 0.1 ms (Sprint 2 report). |
| NF3 | WCAG 2.1 AA contrast | PASS | Scripted check: 229 text elements across 10 routes, 0 failures (Sprint 2 report). WAVE: 0 contrast errors on Map, Listing detail and Post. Lighthouse: all automated accessibility audits passed on Map, Listing detail and My Account. |
| NF4 | Alt text on images and icon buttons | PASS | Scripted check: 0 unlabeled controls across 10 routes. WAVE: 0 errors on three pages. VoiceOver read every control tested. |
| NF5 | No horizontal scroll, 375–1440 px | PASS | See "NF5" below: 36 checks at 375 / 390 / 768 px, plus earlier 614 / 1440 px. |
| NF6 | HTTPS only | PASS | See "NF6" below. |
| NF7 | Only verified `@uw.edu` users can read data | PASS | 49 of 49 rules tests. |
| NF8 | Email never shown to other users | PASS | The only email rendered is the user's own on My Account. |
| NF9 | Failed saves leave no partial data | PASS | Rules suite "NF9 real approval transaction fails offline without any partial decision"; PR #79 makes timed-out transactions refuse writes. |
| NF10 | ESLint zero errors | PASS | `npx eslint .` → 0 errors, 1 warning (`AuthContext.jsx` react-refresh). |

## NF5 — responsive check at 375 px

Method: each route was loaded in a same-origin iframe sized 375, 390 and 768 px wide; after 2 s the document's `scrollWidth` was compared with the iframe width. Media queries respond to the iframe width, so this reproduces a narrow viewport (Chrome would not resize the window below 614 px). The Leaflet map container is excluded from the offending-element search only.

Routes: `/map`, `/manage`, `/account`, `/post`, `/post/lend`, `/post/sell`, `/post/give`, `/manage/lend`, `/manage/sell`, `/manage/give`, a give listing detail page, a lend listing detail page.

Result: 12 routes × 3 widths = 36 checks, **0 px horizontal overflow in every case**. Earlier checks at 614 px and 1440 px also showed 0 px.

## NF6 — HTTPS

- Opening `http://info442-husky-share.web.app/` ended on `https://info442-husky-share.web.app/map`.
- On the production page: `location.protocol` is `https:`, `isSecureContext` is `true`, and none of the 20 loaded resources used `http:`.

## NF1 — production load

Cold load of `https://info442-husky-share.web.app/map` (Navigation Timing): DOMContentLoaded 518 ms, load 564 ms. The page loaded from a browser that already had a session; production listing count was not recorded, so the 200-marker condition is covered by the local 238-listing run.

## NF3 / NF4 — tool results

Run on 2026-11-25 against the local dev server, signed in as a seeded test user.

### Lighthouse (Chrome DevTools, Accessibility category, Snapshot mode)

| Page | Automated audits passed | Failed audits |
|---|---|---|
| Map (`/map`) | 26 of 26 | none |
| Listing detail (`/listings/nf1-seed-171`, Borrow) | 21 of 21 | none |
| My Account (`/account`) | 22 of 22 | none |

Lighthouse lists 10 further items as "additional items to manually check" (keyboard focus, tab order, focus traps and similar). The keyboard and screen-reader pass below covers them only in part.

### WAVE (browser extension)

| Page | Errors | Contrast errors | Alerts | AIM score | Notes |
|---|---|---|---|---|---|
| Map (`/map`) | 0 | 0 | 0 | 10 / 10 | 12 empty-alt images are Leaflet map tiles (decorative); search, legend and filters carry `aria-label`s; category chips use `aria-pressed` |
| Listing detail (`/listings/nf1-seed-95`, Free) | 0 | 0 | 1 | 10 / 10 | Alert is one "redundant link"; the no-photo placeholder has `role="img"` and an `aria-label` |
| Post (`/post`) | 0 | 0 | 0 | 10 / 10 | Heading level 1 and the transaction-type list are structural elements |

### VoiceOver (macOS, Chrome)

Reported by Jessie after a manual pass: Map search box and category filters, listing detail photo placeholder, Post form fields and validation messages, and the bottom navigation were all announced.

## Remaining caveats

- Lighthouse, WAVE and VoiceOver were run on the local dev server, not on the production site.
- WAVE's one alert (redundant link on the listing detail page) is not an error and was left as is.
- Lighthouse's manual-check items are only partly covered by the VoiceOver pass.
- The 200-marker condition for NF1 is covered by the local 238-listing run; the production listing count was not recorded.
