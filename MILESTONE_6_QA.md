# Milestone 6 – QA Testing Report

**Project:** Husky Share – INFO 442
**Tester:** Jessie Zhuang (Product Designer)
**Test Date:** November 23, 2026
**Scope:** Milestone 6 – Points, Ratings & Final Integration (Issues #22, #23, #24, #25)
**Environment:** Local Firebase Emulator Suite (Auth + Firestore), Vite dev server at `localhost:5173`, Chrome on macOS, `main` at commit `982b510`; nonfunctional checks also run against the deployed site

## 1. Overview

I tested the Milestone 6 features in the browser: the points system, rating submission, the display of ratings and feedback tags on request cards, and the nonfunctional requirements for the final delivery. I checked the results against the GitHub Issue verification criteria and the requirements in our Requirements document.

Points and ratings only become reachable at the end of a completed two-party transaction, so I ran three test accounts — `alice@uw.edu`, `bob@uw.edu`, `carol@uw.edu` — and completed a full lending transaction, a full purchase, and a full giveaway rather than inspecting the code.

**The lending and purchase paths pass in full. The giveaway path is blocked by two Firestore security rule defects**, one of which is shared with Milestone 5. Both are in Section 3, and both are live in production because the rules deploy on push to `main`.

**Setup checks**

| Check | Result |
|---|---|
| Local `main` updated to latest (`982b510`), no local changes at start | PASS |
| `npm run lint` | PASS – 0 errors, 1 warning (`AuthContext.jsx:74`, react-refresh rule) |
| `npm run build` | PASS – bundle-size warning only (885 kB) |

**Test data (local emulator only)**

| Item | Purpose |
|---|---|
| 36 seeded listings (12 Borrow / 12 Buy / 12 Free) across 8 owners with 0–60 points | P5 ordering, realistic request lists |
| 15 seeded ratings across 6 of those owners | Star averages and tag counts on cards |
| QA Moving Cart, QA Study Desk, QA Floor Lamp, QA Projector | The four flows run end to end |

## 2. Testing Results

### Issue 6.1 – Implement the Points System (#22)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Completed lending transaction adds 10 points to the lender | P1 | PASS – total went 0 → 10 |
| Completed lending transaction adds 5 points to the borrower | P2 | PASS – total went 0 → 5 |
| Completed giveaway adds 15 points to the giver | P3 | PASS – total went 10 → 25 *(after BUG-1 patched)* |
| Reopening a points page does not award the points again | P4 | PASS – reload left the total unchanged on both the lending and giveaway pages |
| L8 shows "+10 points", B8 shows "+5 points", G5 shows "+15 points" | L8.1, B8.1, G5.1 | PASS |
| Each points page shows the user's updated total | L8.2, B8.2, G5.2 | PASS |
| My Account shows the user's total points | H13 | PASS |
| **Search results ordered by the owner's total points, highest first** | **P5** | **PASS** |

**Notes:**

- P5 was checked against seeded owners with known totals. Searching "desk" returned, in order: Desk Organizer (owner 60 points), Desk Mat (30), Desk Lamp (15). The ordering was correct.
- Points are never written on their own. Each award is part of the same Firestore transaction that moves the stage, guarded by a `pointsRecords/{requestId}_{uid}` document. The rules independently check that the matching record exists after the write and that the new total is exactly the old total plus the right amount.
- Until the points record exists, the page shows "Processing completion points…" rather than a wrong number.
- **Known race, not reproduced:** `MapPage` loads listings first and owner point totals in a second request. A search submitted inside that window would sort every owner as 0. I tried to reproduce it and could not — on the local emulator the second request resolves too quickly. It remains a real code-level risk on a slow connection. Issue #22 (Harry Han).

### Issue 6.2 – Implement Rating Submission (#23)

**Result: PASS – giveaway rating was blocked by BUG-4 during testing; fixed in #69 and retested**

| Test | Requirement | Result |
|---|---|---|
| A 1–5 star input is shown when the transaction has not been rated | R1 | PASS |
| **Clicking the 4th star fills stars 1–4** (verified: `★★★★☆`, `aria-pressed` true/true/true/true/false) | **R2** | **PASS** |
| Clicking an unselected tag selects it; clicking again unselects it | R3, R4 | PASS |
| A "Submit" button is shown | R5 | PASS |
| Submitting with no stars shows "Please select a star rating." | R6 | PASS |
| A saved rating shows "Rating submitted successfully!" | R7 | PASS |
| Reloading after rating shows "You have already rated this transaction." and no form | R9 | PASS |
| L8 shows "On time", "Polite", "Gentle use", "Quickly reply" | L8.4 | PASS |
| B8 shows "On time", "Polite", "Quickly reply" | B8.4 | PASS |
| G5 shows "On time", "Polite", "Quickly reply" | G5.4 | PASS |
| L8 / B8 / G5 show the rating form for the correct counterpart | L8.3, B8.3, G5.3 | PASS |
| **Submitting a giveaway rating changes the status to "Rate"** | **G5.5** | **PASS – after the BUG-4 fix in #69; retested on `main` @ 6aa6dbd** |
| A failed save shows an error message | R11 | PASS – the failure above surfaced an error rather than hanging |
| A failed save keeps the selected stars and tags | R12 | PASS – stars and tags stayed selected after the failure |

**Notes:**

- R11 and R12 were verified accidentally but genuinely: the giveaway rating failure (BUG-4) produced an error message and left `★★★★★` and the chosen tag selected, which is exactly what those two clauses require.
- Duplicate ratings are blocked twice over: the page hides the form once rated, and the data layer throws if the rating document already exists. The document id is `{requestId}_{uid}`, so a second write cannot create a separate record.
- The tag list is validated in the data layer as well, so a crafted request cannot store arbitrary tags.
- PR #66 added a 15-second timeout and an offline guard to the rating submit during this milestone. The guard is a second copy of `saveWithTimeout`, which now exists in both `OngoingBorrowing.jsx` and `ReturnComplete.jsx`; worth lifting into a shared module.

### Issue 6.3 – Display User Ratings and Feedback (#24)

**Result: PASS – one wording question**

| Test | Requirement | Result |
|---|---|---|
| **Overall rating is the average rounded to a whole star** | **R8** | **PASS – card showed "4 / 5 stars" after a single 4-star rating** |
| A user with no ratings shows "No ratings yet" | R10 | PASS |
| **A request card shows up to three most-received tags** | **R13** | **PASS – card showed "On time, Polite", exactly the two tags given** |
| A user with no tags has no tags displayed | R14 | **PARTIAL – see BUG-5** |
| Lending request cards show the borrower's rating and tags | L4.2, L4.3 | PASS |
| Purchase request cards show the buyer's rating and tags | S3.12, S3.13 | PASS |
| Giveaway request cards show the recipient's rating and tags | G3.11, G3.12 | PASS |

**Notes:**

- **This closes two findings from the Milestone 4 report, now confirmed in the browser rather than in code.** M4-01 (cards showed `4.5 / 5 stars` instead of a whole-star value) is fixed: after Alice rated Bob 4 stars, his card on a later request read `4 / 5 stars`. M4-02 (four equally frequent tags shown when the cap is three) is fixed: the tag list is sorted by count and capped at three. **The Milestone 4 report can be updated to PASS for both.**
- Lending, selling, and giveaway request lists are all served by the same component, so all three were verified by the same checks — a regression here would affect all three.

### Issue 6.4 – Test and Finalize the Application (#25)

**Result: PASS – 8 of 10 nonfunctional requirements verified here; NF1 and NF9 reported as passing by Harry Han**

| Test | Requirement | Result |
|---|---|---|
| Map loads and shows all markers within 3 s with up to 200 active listings | NF1 | PASS – reported by Harry Han; not independently verified here |
| Search results appear within 1 s | NF2 | **PASS – 11 ms measured** |
| All pages meet WCAG 2.1 AA colour contrast | NF3 | **PASS – 110 text elements across 9 routes, 0 failures** |
| Every image and icon button has a text alternative | NF4 | **PASS – 9 routes, 0 failures** |
| No horizontal scrolling from 375 px to 1440 px | NF5 | **PASS – 0 px overflow on Map, Manage, My Account at both widths** |
| All traffic is HTTPS | NF6 | **PASS** |
| Data readable only by signed-in verified `@uw.edu` users | NF7 | **PASS – 24 of 24 rules tests pass** |
| A user's UW email is never shown to other users | NF8 | **PASS – the only email rendered anywhere is the user's own on My Account** |
| A failed request saves no partial data | NF9 | PASS – reported by Harry Han; not independently verified here |
| ESLint passes with zero errors | NF10 | **PASS – 0 errors, 1 pre-existing warning** |

**How NF3 and NF4 were measured.** A third-party audit script could not be loaded into the signed-in session, so I ran a purpose-written check in the page. For NF3 it walks every element holding visible text, resolves the effective background through alpha compositing, and compares the contrast ratio against 4.5:1, or 3:1 for large text. For NF4 it checks that every `img` has a non-empty `alt`, that every button and link resolves to an accessible name, and that every visible form control has a real `<label>` — including the photo input. Routes covered: Map, Post, Post/Lend, Post/Sell, Post/Give, Manage, Manage/Lend, Manage/Sell, Manage/Give, My Account. This is not a Lighthouse, WAVE, or screen-reader run, and the Requirements document names those tools, so a VoiceOver pass is still worth doing.

**How NF7 was measured.** `npm run test:rules` with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, against the Firestore emulator: **24 tests, 24 pass, 0 fail, 1059 ms**. The `PERMISSION_DENIED` lines in the output are expected — they come from the suite's own `assertFails` cases. The suite was run with BUG-1's one-line guard applied locally, but that guard changes only the `pointsRecords` *read* rule, and the suite's seven references to `pointsRecords` are all writes, so the result holds for the committed rules as well.

**The rules suite does not run from a clean checkout.** `tests/firestore.rules.test.js` imports `@firebase/rules-unit-testing`, which is listed in neither `dependencies` nor `devDependencies`. CI works around this — `.github/workflows/lint.yml` installs it with `--no-save` before running the suite under `emulators:exec`, so the suite does run on every pull request. The gap is local only: `npm run test:rules` fails with `ERR_MODULE_NOT_FOUND` for a developer who has just cloned and run `npm install`, which is why this clause had gone unverified here. The version also has to be pinned: 5.x and 6.x require `firebase ^12` and this project is on `firebase ^11.10.0`, so npm refuses them. See BUG-6.

**On NF1 and NF9.** Neither was exercised in this round. The environment held about 40 listings, well short of the 200 the clause names, and the map still loaded quickly (DOMContentLoaded 259 ms, last tile 566 ms) — but that says nothing about the stated condition. NF9 needs a browser offline toggle. Harry Han reports both as passing; those two rows record his result, not an observation of this tester, and are marked as such. `scripts/seed-listings.js` is in the repository if anyone wants to reproduce NF1: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=info442-husky-share node scripts/seed-listings.js 200`, then time the map in the DevTools Network panel; `... seed-listings.js clean` removes the data afterwards.

## 3. Bugs and Follow-Up

### Bugs Found

**BUG-1 (shared with Milestone 5) — Giveaway pickup fails for every user — BLOCKING — FIXED**

- **Where:** `firestore.rules`, the `pointsRecords` read rule
- **Cause:** the rule had no null guard. `confirmSellGivePickup` reads `pointsRecords/{requestId}_{ownerId}` before writing it, to keep P4 idempotent; on a document that does not exist, `resource` is null and the expression throws, so the read is denied and the transaction fails.
- **Impact while open:** blocked G4.8, G4.9, P3 and all of G5, on local and in production.
- **Assigned Issue:** #54 / #16 (Ling Wang)
- **Status: FIXED** in PR #69, merged as part of `6aa6dbd`. The committed fix also requires the document id to end with the caller's own uid, so the rule cannot be used to probe for another user's points record.
- **Retested on `main` @ 6aa6dbd (Nov 24):** pickup confirmed, stage `Approved` → `Pickup`, giver's points 25 → 40. PASS.

**BUG-4 — Giveaway rating cannot be submitted (G5.5) — BLOCKING — FIXED**

- **Where:** `src/data/completion.js`, `submitRating`
- **Cause:** the rating document was built with `rateeId: role === 'lender' ? request.requesterId : request.ownerId`. On the giveaway path the rater is the giver, whose uid *is* `request.ownerId`, so `rateeId` named the rater instead of the recipient. The rules require an owner's rating to name the requester as ratee, so the create was refused and the paired request update to "Rate" failed with it. Lending and purchase were unaffected because `role === 'lender'` took the correct branch.
- **This was not a rules defect.** The rules suite already contained a test (`giver can rate recipient only once after giveaway pickup and advance to Rate`) that commits exactly this pair of writes, and it passes. The `getAfter` on the ratings rule and the `existsAfter` on the requests rule resolve correctly together; only the application's payload was wrong. An earlier draft of this report attributed the failure to a circular dependency between those two rules and recommended removing one of them. That diagnosis was wrong and no security condition needed to change.
- **Impact while open:** blocked G5.5 and the whole giveaway rating flow, on local and in production.
- **Assigned Issue:** #59 / #24 (Ling Wang)
- **Status: FIXED** in PR #69 (`rateeId = role === 'borrower' ? request.ownerId : request.requesterId`), merged as part of `6aa6dbd`.
- **Retested on `main` @ 6aa6dbd (Nov 24):** a fresh giveaway from listing to rating — "Rating submitted successfully!", stage `Pickup` → `Rate`, stored `rateeId` equals the recipient, 4 stars and the `Polite` tag saved, and the new `ratingSummaries` document correctly read `ratingTotal 13 / ratingCount 3 / overallRating 4`. PASS.

**BUG-6 — The rules test suite cannot be run locally from a clean checkout — LOW**

- **Where:** `package.json`
- **Cause:** `tests/firestore.rules.test.js` imports `@firebase/rules-unit-testing`, which is in neither `dependencies` nor `devDependencies`. `npm run test:rules` therefore fails with `ERR_MODULE_NOT_FOUND` for anyone who has not installed the package by hand.
- **Impact:** Local only. CI is unaffected: `lint.yml` installs the package with `--no-save` before running the suite, so the rules tests do run on every pull request. The cost is that a developer who wants to run the suite locally hits an error with no hint of the required version pin.
- **Severity:** Low — no user-facing effect, and the regression suite is still enforced in CI.
- **Fix:** add `"@firebase/rules-unit-testing": "^4.0.1"` to `devDependencies` **and regenerate `package-lock.json` in the same commit** — both workflows run `npm ci`, which fails if the two files disagree. The version matters: 5.x and 6.x declare a peer dependency on `firebase ^12`, which npm refuses alongside this project's `firebase ^11.10.0`. Once added, the `--no-save` line in `lint.yml` can be dropped.

**BUG-5 — A user with no tags still gets a tag line (R14)**

- **Where:** `src/pages/ListingRequests.jsx`
- **Actual:** The card renders "Most received tags: No tags yet". Confirmed in the browser on Bob's first request, before he had been rated.
- **Expected:** R14 says that when a user has received no tags, no tags are displayed on their request card.
- **Severity:** Low, and arguably a wording question. No tags *are* shown; a placeholder is. R10 explicitly asks for a "No ratings yet" string in the equivalent situation and R14 pointedly does not.
- **Assigned Issue:** #24 (Ling Wang)
- **Follow-up:** Either drop the line when the tag list is empty, or have the PM confirm the placeholder and note the decision against R14.

### Code Inspection Findings (Not Browser-Tested)

| Finding | Related requirement | Notes |
|---|---|---|
| `ratingSum` and `ratingCount` are documented but never written | R8 | `schema.js` lists both on the user document, but nothing maintains them. R8 is recomputed on every read by querying all of a user's ratings, once per requester per card. Correct today; the read cost grows with rating volume. Either remove the dead fields or maintain the aggregates on write. Issue #24 (Ling Wang). |
| `saveWithTimeout` now exists in two files | – | PR #66 copied it into `ReturnComplete.jsx` rather than sharing it with `OngoingBorrowing.jsx`. Worth extracting. Issue #23 (Peitong Qi). |

### Still Needs Testing

| Priority | Item | Follow-up |
|---|---|---|
| High | G5.5 and the full giveaway rating flow | Retest once the BUG-4 one-line fix is merged |
| Medium | NF1 – 200-listing map load | Use `scripts/seed-listings.js` as described above |
| Medium | NF9 – offline behaviour | DevTools → Network → Offline on the listing form and the rating form |
| Low | NF3 / NF4 with the named tools | A Lighthouse run and a VoiceOver pass, since the Requirements document specifies those |

## 4. Additional Observations

- Points and ratings are consistently written inside Firestore transactions, and the rules verify the resulting state rather than trusting the client. The idempotency key on `pointsRecords` means P4 holds even if a request is replayed — confirmed by reloading both points pages.
- Both blocking defects were fixed in PR #69 while this report was being written, and both were retested against `main` rather than against a local patch.
- PR #69 also introduced `ratingSummaries` with a migration guard: if a user has existing ratings but no summary document, `submitRating` refuses with "Existing ratings need to be migrated before a new rating can be saved." Any environment carrying older rating data — including a local emulator used for a demo — must run `scripts/backfill-rating-summaries.js --apply` first. Production is covered by the migration gate added to `deploy.yml`.
- All four Issues in this milestone (#22, #23, #24, #25) are still open on GitHub even though their code is merged into `main`, so the milestone reads as 0% complete on the Milestones page.
- The two display findings from the Milestone 4 report (M4-01 whole-star rounding, M4-02 three-tag cap) are now confirmed fixed in the browser; that report can be updated.
- M4-04 (should the unviewed-request count include cancelled-but-unviewed requests?) and M4-06 (a direct SDK write could approve one request without declining the others) remain open. On M4-06: the ordinary application path is correct — approving one of two pending requests on the same listing correctly declined the other, verified with three accounts (LS4). The remaining gap is only reachable by bypassing the app, and a single-document rule cannot assert a condition across a set of other documents, so closing it properly would need a Cloud Function. Worth recording as a known limitation rather than an open bug.

## 5. Overall Assessment

**All three flows — lending, buying and giving — are complete and correct end to end on `main` @ 6aa6dbd.** Giving was blocked by two defects during testing (BUG-1 and BUG-4); both were fixed in PR #69 and retested.

| Issue | Result |
|---|---|
| #22 – Implement the Points System | PASS – P1, P2, P3, P4, P5 and H13 all verified |
| #23 – Implement Rating Submission | PASS – lending and purchase ratings verified; G5.5 verified after the BUG-4 fix in #69 |
| #24 – Display User Ratings and Feedback | PASS – R8 and R13 confirmed fixed; R14 wording to confirm |
| #25 – Test and Finalize the Application | PASS – 8 of 10 NFRs verified here; NF1 and NF9 reported as passing by Harry Han |

Before closing these Issues, the team should:

1. Fix BUG-1 (one line in `firestore.rules`) and BUG-4 (one line in `completion.js`). Until then the giveaway feature does not work for anyone, on local or production.
2. Add the missing `@firebase/rules-unit-testing` devDependency (BUG-6) and run the 200-listing NF1 test.
3. Decide the R14 wording and record decisions on M4-04 and M4-06.
4. Retest the giveaway path end to end against committed code.

**Related GitHub Issues:** #22, #23, #24, #25
