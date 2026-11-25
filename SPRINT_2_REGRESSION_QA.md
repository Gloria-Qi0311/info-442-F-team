# Sprint 2 — Regression QA Report

**Project:** Husky Share — INFO 442  
**Tester:** Jessie Zhuang (Product Designer)  
**Test Date:** November 24, 2026  
**Scope:** Sprint 2 — Milestones 4, 5 and 6 (Issues #18–#25), retested in full against the Requirements document  
**Environment:** Local Firebase Emulator Suite (Auth + Firestore), Vite dev server at `localhost:5173`, Chrome on macOS, `main` at commit `b3c13b1`  
**Accounts:** `alice@uw.edu` (owner), `bob@uw.edu` (requester), `carol@uw.edu` (rival requester)

This is a full re-test, not a delta. Every clause below was exercised on `b3c13b1`, which includes the work merged in PRs #69, #73, #74 and #75 — in particular the epoch-based request model that replaced the stored `Pending` status. Fresh listings and requests were created for the run; results are from observed behaviour, not code review.

---

## 1. Automated Suites

| Suite | Command | Result |
|---|---|---|
| ESLint | `npm run lint` | **PASS** – 0 errors, 1 pre-existing warning (`AuthContext.jsx:74`, react-refresh) |
| Unit tests | `npm run test:unit` | **PASS** – 5 of 5 |
| Rules + client tests | `npm run test:rules` | **PASS** – 49 of 49, 11.9 s |

The rules suite has grown substantially this sprint and now covers forged epoch changes, legacy writes, multiple winners, H4 unviewed counts after an epoch approval, the migration's dry-run safety and idempotency, and an offline approval that leaves no partial decision.

---

## 2. Milestone 4 — Requests & Approval Workflow

### Issue 4.1 — Implement Borrow Requests (#15)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Active listing the user does not own shows "Send request!" | B2.9 | PASS |
| Item details show status, category, condition, lender, pickup area, availability, time slot | B2.1–B2.8 | PASS |
| Borrow form shows start date, return date, pickup preference, purpose | B3.1–B3.4 | PASS |
| Empty form is rejected | B3 | PASS – "Please enter a start date." |
| Start date in the past is rejected | B3 | PASS – "Start date must be today or later." |
| Return date before start date is rejected | B3 | PASS – "Return date cannot be before start date." |
| Dates outside the availability window are rejected | B3 | PASS – "Choose dates within the item availability period." |
| Missing purpose is rejected | B3 | PASS – "Please enter a purpose of use." |
| Valid request saves as Pending | B4.1–B4.9 | PASS |
| Pending page shows item name, status, dates, pickup preference, purpose, time sent | B4.1–B4.9 | PASS |
| Borrower can cancel a pending request | B4 | PASS – status becomes "Canceled", "You canceled this request." |
| A canceled request can be re-submitted | LS | PASS – returns to Pending |

### Issue 4.2 — Implement Purchase Requests (#16)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Sale item shows price formatted to two decimals | S5 | PASS – `$45.00` |
| Active sale item shows "I want it" | S5.10 | PASS |
| Request saves and shows "Your request: Pending" | S5.11–S5.19 | PASS |
| Buyer can cancel, then request again | S5.24–S5.25 | PASS – Canceled → "I want it" returns → Pending |
| Seller sees buyer name and rating on the request | S3.11–S3.16 | PASS – "Buyer: Bob Tester", "4 / 5 stars", "Most received tags: On time, Polite" |

### Issue 4.3 — Implement Giveaway Requests (#17)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Free item shows "Free" as the price and an "I want it" button | G6.11 | PASS |
| Request saves as Pending | G6.12–G6.20 | PASS |
| Giver sees the requester's name and rating | G3.10–G3.15 | PASS – "Recipient: Bob Tester" |

### Issue 4.4 — Request Approval and Status Updates (#18)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Approve shows pickup date, time and location fields | L4.9–L4.11, S3.17–S3.19, G3.16–G3.18 | PASS |
| Missing pickup date rejected | L4 | PASS – "Please enter a pickup date." |
| Past pickup date rejected | L4 | PASS – "Pickup date must be today or later." |
| Blank pickup location rejected | L4 | PASS – "Please enter a pickup location." |
| Approving a borrow request sets the listing to "On Loan" | LS5 | PASS |
| Approving a purchase sets the listing to "Sold" | S3 | PASS |
| Approving a giveaway sets the listing to "Given Away" | G3 | PASS |
| **Approving one request declines every other pending request** | **LS4** | **PASS** |
| The declined rival sees "Declined" with an explanation | B4.10–B4.12 | PASS – "The item owner declined your request." |
| An unavailable item cannot receive a new request | LS7–LS8 | PASS – "Item is unavailable." |
| Only the owner can decide a request | LS | PASS – a non-owner call is refused |
| Declining leaves the listing Active and does not decline others | LS | PASS – listing stays Active, epoch unchanged |
| Manage shows the number of unviewed requests | H4 | PASS – badge showed 3, then 1 after the requests page was opened |
| Manage lists the requests the user has sent, with status | H8–H10 | PASS |

**On LS4.** This is the clause that failed in the Milestone 4 report and was reworked in PR #75. The new model is epoch-based: each listing carries `approvalEpoch`, each request carries `requestEpoch`, and an undecided request is Pending only while the two match. Approving bumps the listing's epoch in the same transaction as the decision, so every rival becomes Declined without a fan-out write. Observed directly: after Bob's request was approved, the listing read `On Loan` with `approvalEpoch: 1`, Bob's request carried a stored `Approved`, and Carol's request — still `requestEpoch: 0`, with no stored status — derived as `Declined`. Carol's own page and her Manage list both showed "Declined".

---

## 3. Milestone 5 — Transaction & Pickup Completion

### Issue 5.1 — Build Ongoing Transaction Pages (#19)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Lender's page shows borrower name, pickup day, time, location | L5.1–L5.12 | PASS |
| Borrower's page shows pickup details and return due date | B5.1–B5.13 | PASS |
| Seller's page shows buyer name and pickup details | S6.1–S6.6 | PASS |
| **Giver's page shows the recipient's name** | **G4.4** | **PASS – previously missing, now implemented** |
| Progress timeline shows four stages with the current one highlighted | L5, B5 | PASS – Approved (current) → Pickup → Return → Received |
| Completed stages are marked | L5, B5 | PASS – "✓ Approved (completed)" after pickup |

### Issue 5.2 — Borrowing Pickup Confirmation (#20)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Confirmation page offers a photo field | L6.1–L6.7, B6.1–B6.7 | PASS |
| Confirming without a photo is rejected | L6, B6 | PASS – "Please upload a photo." (see S2-01) |
| One side confirming does not advance the stage | L6, B6 | PASS – "Pickup confirmed. Waiting for the other person." |
| Both sides confirming advances the stage to Pickup | L6, B6 | PASS |

### Issue 5.3 — Borrowing Return Confirmation (#21)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Borrower can mark the item returned with a photo | B7.1–B7.6 | PASS – stage becomes Return, "Waiting for the lender to confirm the return." |
| Lender confirms receipt | L7.1–L7.7 | PASS – advances to the Return Complete & Rating page |
| **The listing becomes Active again after Received** | **LS6** | **PASS** |

### Issue 5.4 — Selling and Giveaway Pickups (#22)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Buyer confirms a purchase pickup | S6.7 | PASS – stage becomes Pickup |
| Only the buyer can confirm a purchase pickup | S6.7 | PASS – the seller is refused: "Only the buyer or the giver can confirm this pickup." |
| Giver confirms a giveaway pickup | G4.8–G4.9 | PASS – stage becomes Pickup, Points & Rating page opens |
| A failed confirmation leaves the status unchanged | S6.9, G4.11 | PASS – a repeat attempt is refused and nothing changes |

---

## 4. Milestone 6 — Points, Ratings & Final Integration

### Issue 6.1 — Implement the Points System (#22)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Lender receives 10 points on a completed loan | P1 | PASS – 40 → 50 |
| Borrower receives 5 points | P2 | PASS |
| Giver receives 15 points | P3 | PASS – 50 → 65 |
| Points are not awarded twice | P4 | PASS – repeat refused ("This item has already been picked up."), total unchanged at 65, one `pointsRecords` document per award |
| Search results are ordered by the owner's total points | P5 | PASS – Alice (65) → Bob (10) → Carol (0) |
| My Account shows the user's total points | H13 | PASS – 65 |

### Issue 6.2 — Implement Rating Submission (#23)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Rating form offers 1–5 stars and feedback tags | R1–R6 | PASS – star buttons carry `aria-label` and `aria-pressed` |
| Submitting with no star rating is rejected | R | PASS – "Please select a star rating." |
| A valid rating saves | R7, L8.3–L8.4 | PASS – "Rating submitted successfully!" |
| The same transaction cannot be rated twice | R9 | PASS – "You have already rated this transaction." |
| **Giveaway rating advances the status to "Rate"** | **G5.5** | **PASS – previously blocked, fixed in #69** |

### Issue 6.3 — Display User Ratings and Feedback (#24)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| Average rating updates after a new submission | R8 | PASS – `ratingSummaries` read `ratingTotal 17 / ratingCount 4 / overallRating 4` |
| Users with no ratings show "No ratings yet" | R10 | PASS – shown on Carol's request card |
| Request cards show up to three most-received tags | R13 | PASS – "On time, Polite, Gentle use" |

### Issue 6.4 — Test and Finalize the Application (#25)

**Result: PASS — 9 of 10 nonfunctional requirements verified here**

| Test | Requirement | Result |
|---|---|---|
| Map loads and shows all markers within 3 s with up to 200 active listings | NF1 | **PASS – 238 active listings, data load 34–73 ms over three runs** |
| Search results appear within 1 s | NF2 | **PASS – client-side filter, 0.1 ms** |
| All pages meet WCAG 2.1 AA colour contrast | NF3 | **PASS – 229 text elements across 10 routes, 0 failures** |
| Every image and icon button has a text alternative | NF4 | **PASS – 0 unlabeled controls, 0 unnamed buttons or links across 10 routes** |
| No horizontal scrolling | NF5 | **PASS at 614 px and 1440 px – 0 px overflow on 6 routes** (see note) |
| All traffic is HTTPS | NF6 | Not applicable locally; production is served over HTTPS |
| Data readable only by signed-in verified `@uw.edu` users | NF7 | **PASS – 49 of 49 rules tests** |
| A user's UW email is never shown to other users | NF8 | **PASS – the only email rendered is the user's own on My Account** |
| A failed request saves no partial data | NF9 | **PASS – covered by the rules suite's "NF9 real approval transaction fails offline without any partial decision"** |
| ESLint passes with zero errors | NF10 | **PASS – 0 errors** |

**How NF1 was measured.** The environment held 238 active listings, above the 200 the clause names. `getMapListings()` resolved in 34, 40 and 73 ms over three runs, and markers render to a canvas layer immediately afterwards. A cold-load wall-clock figure taken from the DevTools Network panel was not captured in this run; Harry Han reports NF1 as passing from such a measurement.

**How NF3 and NF4 were measured.** A purpose-written check in the page, not Lighthouse or WAVE. For NF3 it walks every element with visible text, resolves the effective background through alpha compositing and compares against 4.5:1, or 3:1 for large text. For NF4 it checks `img` alt text, accessible names on buttons and links, and a real label for every visible form control. Routes: Map, Manage, My Account, Post, Post/Lend, Post/Sell, Post/Give, Manage/Lend, Manage/Sell, Manage/Give. Six images on the Map route carry `alt=""` — these are Leaflet map tiles, and an empty alt is the correct treatment for decorative images. A VoiceOver pass is still worth doing, since the Requirements document names screen-reader tools.

**Note on NF5.** Chrome would not resize its window below 614 px of inner width, so the 375 px case could not be reproduced here. Both tested widths showed 0 px of overflow on every route. A 375 px check needs DevTools device emulation.

---

## 5. Findings

### S2-01 — A missing photo is reported as a connection problem — LOW

- **Where:** `src/pages/OngoingBorrowing.jsx`, `confirm()`
- **Steps:** Open a pickup or return confirmation page, press the confirm button without choosing a photo.
- **Actual:** Two messages appear together — "Please upload a photo." and "Your confirmation was not completed. Check your connection and try again."
- **Cause:** `setRetryHint(...)` is called unconditionally in the `catch` block, so a pure validation failure inherits the network retry hint.
- **Impact:** A user who simply forgot the photo is told to check their connection. The clause itself (L6, B6: a missing photo shows an error) is satisfied, so this is clarity rather than correctness.
- **Fix:** set the retry hint only when the failure is not the validation error — the branch that distinguishes them already exists two lines above.
- **Related Issue:** #20

### S2-02 — Local emulator data predates the epoch migration — BLOCKING FOR THE DEMO

- **Where:** local Firebase emulator data, not the application
- **Detail:** All 241 listings in the emulator carry no `requestSchemaVersion`. `requireRequestSchema()` rejects any listing that is not at version 2, so every request and approval against the existing demo data fails with "This item is being updated. Please try again later." The 36 seeded demo listings and the NF1 seed data are all affected.
- **Production is not affected:** `deploy.yml` runs `migrate-request-epochs.js` as a dry run, deploys the rules, then runs it with `--apply`, on every push to `main`.
- **Fix before any demo that uses this emulator:**
  ```
  GCLOUD_PROJECT=info442-husky-share FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-request-epochs.js
  GCLOUD_PROJECT=info442-husky-share FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-request-epochs.js --apply
  ```
  Run the dry run first; it validates the legacy data and names any record that needs repair. The same applies to `backfill-rating-summaries.js --apply`, without which rating submission refuses on any user who already has ratings.
- **Note:** the listings created during this test run were made by the current code and are already at version 2, which is why the flows above all passed.

### S2-03 — The rules deny path can return an unreadable error — LOW, worth watching

- **Where:** `firestore.rules`
- **Steps:** Attempt to approve a request that has already been decided.
- **Actual:** `Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached. for 'update' @ L222 …` instead of the application's own "This request is no longer pending."
- **Detail:** The rules are close to Firestore's per-request expression ceiling. On the happy path everything evaluates and every flow above passed; it is the deny path, where more branches are tried, that reaches the limit. Two consequences: the message is useless to a user, and further rule complexity may start failing legitimate writes.
- **Related:** this is the same family as the earlier finding that raw rules text reaches the interface.
- **Related Issue:** #24 (rules), #21 (error presentation)

### Previously reported, now fixed

| Finding | Status |
|---|---|
| BUG-1 — giveaway pickup denied by the `pointsRecords` read rule | Fixed in #69, verified here |
| BUG-2 — the Ongoing Giveaway page never showed the recipient's name (G4.4) | Fixed, verified here |
| BUG-4 — giveaway rating refused because `rateeId` named the giver | Fixed in #69, verified here |
| BUG-6 — `@firebase/rules-unit-testing` missing from `package.json` | Fixed — now in `devDependencies` with `package-lock.json` updated |

### Still open from earlier reports

| Finding | Note |
|---|---|
| BUG-3 — raw Firestore rules text reaches the interface | Still reachable, see S2-03 |
| BUG-5 — R14 tag-line wording | Not revisited in this run |
| M4-04 — should the unviewed count include cancelled-but-unviewed requests? | Team decision |
| M4-06 — a direct SDK write bypassing the app | Addressed by the epoch model in #75; the rules suite now asserts it |

---

## 6. Overall Assessment

**All three workflows — borrowing, buying and giving — complete end to end on `main` @ `b3c13b1`.**

| Issue | Result |
|---|---|
| #15 – Implement Borrow Requests | PASS |
| #16 – Implement Purchase Requests | PASS |
| #17 – Implement Giveaway Requests | PASS |
| #18 – Request Approval and Status Updates | PASS – LS4 verified under the new epoch model |
| #19 – Build Ongoing Transaction Pages | PASS – G4.4 now implemented |
| #20 – Borrowing Pickup Confirmation | PASS – see S2-01 |
| #21 – Borrowing Return Confirmation | PASS |
| #22 – Selling and Giveaway Pickups / Points System | PASS |
| #23 – Implement Rating Submission | PASS |
| #24 – Display User Ratings and Feedback | PASS |
| #25 – Test and Finalize the Application | PASS – 9 of 10 NFRs verified here |

Nothing found in this run blocks the application itself. The one item that needs action before a demo is S2-02: the local emulator's data has to be migrated, or the request and rating flows will refuse on every pre-existing item.

**Related GitHub Issues:** #15–#25
