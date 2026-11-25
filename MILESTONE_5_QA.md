# Milestone 5 – QA Testing Report

> **Superseded.** The blocking findings in this report (BUG-1, BUG-4) were fixed in PR #69 and verified
> on `main` @ `b3c13b1`. For the current state of this milestone see `SPRINT_2_REGRESSION_QA.md`,
> which retests Milestones 4-6 in full. The report below is kept as the record of what was found at the time.


**Project:** Husky Share – INFO 442
**Tester:** Jessie Zhuang (Product Designer)
**Test Date:** November 23, 2026
**Scope:** Milestone 5 – Transaction & Pickup Completion (Issues #18, #19, #20, #21)
**Environment:** Local Firebase Emulator Suite (Auth + Firestore), Vite dev server at `localhost:5173`, Chrome on macOS, `main` at commit `982b510`

## 1. Overview

I tested the Milestone 5 features in the browser: the ongoing transaction pages for borrowing, buying, and giving; the two-sided pickup confirmation for lending; the return confirmation flow; and the pickup completion for selling and giveaways. I checked the results against the GitHub Issue verification criteria and the requirements in our Requirements document.

All testing ran against the **local Firebase emulators**, not the production project. No production data, security rules, or configuration were changed.

Milestone 5 is almost entirely two-party, so I ran three test accounts and drove each side of every handoff: `alice@uw.edu` (owner), `bob@uw.edu` (requester), and `carol@uw.edu` (second requester, used for the LS4 check). Each full flow was completed end to end rather than inspected in code.

**One blocking defect was found.** Giveaway pickup fails for every user because of a Firestore security rule, which also blocks everything downstream of it in Milestone 6. Details in Section 3.

**Setup checks**

| Check | Result |
|---|---|
| Local `main` updated to latest (`982b510`), no local changes at start | PASS |
| `npm run lint` | PASS – 0 errors, 1 warning (`AuthContext.jsx:74`, react-refresh rule) |
| `npm run build` | PASS – bundle-size warning only (885 kB) |
| Emulators start and the app signs in with `@uw.edu` test accounts | PASS |

**Test data (local emulator only)**

| Item | Type | Pickup area | Purpose |
|---|---|---|---|
| QA Moving Cart | Borrow | HUB | Full lending flow, end to end |
| QA Study Desk ($12.50) | Buy | Suzzallo Library | Full purchase flow |
| QA Floor Lamp | Free | The Ave | Full giveaway flow |
| QA Projector | Borrow | Red Square | LS4 – two requesters on one listing |
| 36 seeded listings (12 Borrow / 12 Buy / 12 Free) | Mixed | All 8 areas | Owners with 0–60 points, for P5 and realistic lists |

## 2. Testing Results

All results below come from **manual browser testing** unless marked otherwise.

### Issue 5.1 – Build Ongoing Transaction Pages (#18)

**Result: PARTIAL PASS – G4.4 is not implemented**

| Test | Requirement | Result |
|---|---|---|
| Lender L5 shows a "Ready for pick up" card | L5.1 | PASS |
| Lender L5 shows pickup day, time, and location | L5.2–L5.4 | PASS |
| Four-stage timeline: Approved, Pickup, Return, Received | L5.5, B5.5 | PASS |
| Current stage is highlighted (verified via `aria-current` and the "(current stage)" label) | L5.6, B5.6 | PASS |
| At "Approved", "Mark as picked up" is shown | L5.7, B5.7 | PASS |
| "Mark as picked up" opens the Pickup Confirmation page | L5.8, B5.8 | PASS |
| At "Pickup", the return due date is shown | L5.9, B5.9 | PASS |
| At "Pickup", the lender does **not** see a "Confirm return" button | L5.10 | PASS |
| At "Pickup", the borrower sees "Mark as returned" | B5.10 | PASS |
| "Mark as returned" opens the Return Confirmation page | B5.11 | PASS |
| At "Return", the lender sees "Confirm return" | L5.11, L5.12 | PASS |
| At "Received", the borrower sees "Rate lender" | B5.12, B5.13 | PASS |
| Buyer S6 shows pickup date, time, and location | S6.1–S6.3 | PASS |
| Buyer S6 shows a two-stage timeline (Approved, Pickup) | S6.4, S6.5 | PASS |
| At "Approved", the buyer sees "Mark as Picked Up" | S6.6 | PASS |
| Seller sees "Waiting for the buyer to mark the item as picked up" instead of a button | S6.6 | PASS |
| Giver G4 shows pickup date, time, and location | G4.1–G4.3 | PASS |
| **Giver G4 shows the recipient's name** | **G4.4** | **FAIL** |
| Giver G4 shows a three-stage timeline (Approved, Pickup, Rate) | G4.5, G4.6 | PASS |
| At "Approved", the giver sees "Mark as Picked Up" | G4.7 | PASS |
| A user who is not a participant cannot open the page | – | PASS |

**Notes:**

- All six roles are served by one component with a role map, so the lender, borrower, seller, buyer, giver, and recipient views stay consistent. Editing the role in the URL to view someone else's transaction is refused.
- The "Ready for pick up" card renders at every stage, including after the item has been returned and received. Cosmetic, but it reads oddly at that point.
- B5.12, S6.6, and G4.7 are links rather than `<button>` elements. They behave the same with a mouse and with the keyboard; noted only for exactness against the requirement wording.

### Issue 5.2 – Implement Borrowing Pickup Confirmation (#19)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| L6 / B6 show a photo upload area | L6.1, B6.1 | PASS |
| L6 / B6 show a "Pick up confirmed" button | L6.2, B6.2 | PASS |
| Confirming without a photo shows "Please upload a photo." | L6.3, B6.3 | PASS |
| **Borrower confirms alone → status stays "Approved"** | **B6.5** | **PASS** |
| **Lender reloads after the borrower's confirmation → still "Approved", button still available** | **L6.5** | **PASS** |
| **Second side confirms → status becomes "Pickup", Approved marked completed** | **L6.4, B6.4** | **PASS** |
| Confirming twice does not create a second confirmation | – | PASS |

**Notes:**

- The one-sided case is the most important behaviour in this Issue, and it holds. After Bob confirmed, Alice's page still showed Approved with the button available, and the app showed Bob "Pickup confirmed. Waiting for the other person."
- The rule is enforced in two places, not only the UI: `confirmExchange` writes the new stage only when the other party's confirmation document already exists, and `firestore.rules` independently requires both `confirmationPhotos` documents to exist after the write.
- Unlike the listing form, the confirmation photo input does not validate the file when it is chosen; an invalid file is rejected only after the button is pressed. See Section 3.

### Issue 5.3 – Implement Borrowing Return Confirmation (#20)

**Result: PASS**

| Test | Requirement | Result |
|---|---|---|
| L7 / B7 show a photo upload area and a confirm button | L7.1–L7.2, B7.1–B7.2 | PASS |
| Confirming without a photo shows "Please upload a photo." | L7.3, B7.3 | PASS |
| Borrower confirms return → status becomes "Return" | B7.4 | PASS |
| Borrower then sees "Waiting for the lender to confirm the return." | – | PASS |
| Lender confirms receipt → status becomes "Received" | L7.4 | PASS |
| Reaching "Received" opens the Return Complete page for the lender | L7.5 | PASS |
| **Listing returns to "Active" after the transaction completes** | **LS6** | **PASS** |
| Pending request count on the listing returns to 0 | – | PASS |

**Notes:**

- LS6 and the points award happen in the same Firestore transaction as the stage change, so the listing cannot be reactivated without the points being recorded, or the reverse. Confirmed by checking the Manage page immediately after: status `Active`, and both users' totals updated.
- The lender's confirmation also checks that the listing is still "On Loan" and still points at this request before reactivating it.

### Issue 5.4 – Complete Selling and Giveaway Pickups (#21)

**Result: PARTIAL PASS – giveaway pickup is blocked by a security rule**

| Test | Requirement | Result |
|---|---|---|
| Buyer marks pickup → status becomes "Pickup", "The sale is complete." | S6.7 | PASS |
| Only the buyer can confirm a purchase pickup | S6.7 | PASS |
| **Giver marks pickup → status becomes "Pickup"** | **G4.8** | **FAIL – blocked, see BUG-1** |
| Reaching "Pickup" on a giveaway opens the Points & Rating page | G4.9 | PASS *(only after the rule was patched locally)* |
| Giveaway points are not awarded twice on reload | P4 | PASS *(after patch)* |
| A failed confirmation leaves the status "Approved" | S6.9, G4.11 | PASS |
| A failed confirmation shows an error naming the step | S6.8, G4.10 | PASS |

**Notes:**

- The failure message that appeared on the real failure was `Pickup could not be confirmed. evaluation error at L345:22 for 'get' @ L345 … Null value error.` — the raw rules engine text is shown to the user. Even after BUG-1 is fixed, a raw rules error should not reach the interface.
- Which side confirms differs by type, and both the UI and the data layer enforce it: for a sale the **buyer** confirms, for a giveaway the **giver** does. The wrong party sees an explanatory message instead of a button.

## 3. Bugs and Follow-Up

### Bugs Found

**BUG-1 — Giveaway pickup fails for every user (G4.8) — BLOCKING**

- **Where:** `firestore.rules:345`
- **Steps:** Sign in as the giver → approve a giveaway request → open the Ongoing Giveaway page → "Mark as Picked Up" → "Confirm Pickup".
- **Expected:** The status changes to "Pickup" and the Points & Rating page opens.
- **Actual:** The write is refused and the page shows `Pickup could not be confirmed. evaluation error at L345:22 for 'get' @ L345, false for 'get' @ L378, Null value error.`
- **Cause:** The `pointsRecords` read rule is `allow read: if isUwUser() && resource.data.userId == request.auth.uid;`. `confirmSellGivePickup` reads `pointsRecords/{requestId}_{ownerId}` **before** writing it, to keep points idempotent (P4). On a document that does not exist yet, `resource` is null and `resource.data.userId` throws, so the read is denied and the whole transaction fails. Confirmed directly: reading an existing points record succeeds, reading a non-existent one returns `permission-denied`. Lending is unaffected because `confirmExchange` never reads that collection.
- **Severity:** Blocking. It stops G4.8, G4.9, P3 and the whole of G5, and the same rules are deployed to production by the push-to-main workflow, so the live site has the same fault.
- **Assigned Issue:** #54 / #16 (Ling Wang)
- **Fix:** one line, matching the guard already used for `confirmationPhotos` on line 296:
  `allow read: if isUwUser() && (resource == null || resource.data.userId == request.auth.uid);`
  Applied locally during testing so the rest of the flow could be exercised; **not committed**.

**BUG-2 — The Ongoing Giveaway page never shows the recipient's name (G4.4)**

- **Where:** `src/pages/OngoingBorrowing.jsx`
- **Expected:** When a giver opens G4, the recipient's name is displayed.
- **Actual:** The page shows the item title and the pickup date, time, and location. No participant name appears for any role. The request document already carries `requesterName`, so the data is available and simply never rendered.
- **Severity:** Medium — a missing requirement, not a broken flow.
- **Assigned Issue:** #18 (Peitong Qi)
- **Follow-up:** Render `request.requesterName` on the giveaway ongoing page. Worth deciding at the same time whether the other roles should show the other party's name; the requirements only ask for it on G4.

**BUG-3 — A raw Firestore rules error is shown to the user**

- **Where:** `src/pages/OngoingBorrowing.jsx`, `markPickedUp` error handling
- **Actual:** A rules rejection is concatenated into the user-facing message, producing `evaluation error at L345:22 for 'get' @ L345 …`.
- **Severity:** Low, but it leaks internal rule structure and is unreadable.
- **Assigned Issue:** #21 (Harry Han)
- **Follow-up:** Show a fixed message for permission errors and log the detail to the console.

### Code Inspection Findings (Not Browser-Tested)

| Finding | Related requirement | Notes |
|---|---|---|
| The confirmation photo input does not validate on selection | PH2 | The listing form calls `checkPhotoFile` when a file is chosen and shows the error immediately. The pickup/return input accepts anything and rejects it only inside `confirmExchange`. Safe, but inconsistent. Issue #19 (Ling Wang). |
| The "Ready for pick up" card renders at every stage | L5.1, B5.1 | Still displayed after the item has been returned and received. Cosmetic. |

### Still Needs Testing

| Priority | Item | Follow-up |
|---|---|---|
| High | Re-run the giveaway flow after BUG-1 is merged | Confirms G4.8 against committed code rather than a local patch |
| Medium | NF9 – offline confirmation | DevTools → Network → Offline during a pickup confirmation; verify the error appears and the stage does not move |
| Medium | Firestore rules suite | `npm run emulators`, then `npm run test:rules` |
| Low | PH2 consistency on the confirmation photo input | Decide whether to validate on selection |

## 4. Additional Observations

- Every write in Milestone 5 goes through `saveWithTimeout`, which rejects immediately when the browser is offline and otherwise gives up after 15 seconds. This is the pattern the Milestone 2 NF9 work introduced and it is applied consistently.
- Each confirmation is stored under a deterministic id (`{requestId}_{kind}_{uid}`), so pressing a confirm button twice cannot create two confirmations.
- Confirmation photos are compressed to a JPEG data URL and stored in Firestore, the same approach used for listing photos, because Firebase Storage needs a paid plan.
- Two of the four Issues in this milestone (#18, #19) are still open on GitHub even though their code is merged into `main`.

## 5. Overall Assessment

**Milestone 5 works end to end for borrowing and buying. Giving is blocked by a one-line security rule defect.**

| Issue | Result |
|---|---|
| #18 – Build Ongoing Transaction Pages | PARTIAL PASS – G4.4 (recipient name) not implemented |
| #19 – Borrowing Pickup Confirmation | PASS – two-sided rule verified with two accounts |
| #20 – Borrowing Return Confirmation | PASS – LS6 and the points award verified |
| #21 – Selling and Giveaway Pickups | PARTIAL PASS – selling passes; giveaway blocked by BUG-1 |

Before closing these Issues, the team should:

1. Fix BUG-1 and redeploy the rules — this also unblocks Milestone 6's giveaway path and is currently broken in production.
2. Add the recipient's name to the Ongoing Giveaway page (G4.4).
3. Stop showing raw rules errors in the interface (BUG-3).
4. Retest the giveaway flow against committed code.

**Related GitHub Issues:** #18, #19, #20, #21
