# Milestone 3 – QA Testing Report

**Project:** Husky Share – INFO 442  
**Tester:** Jessie Zhuang (Product Designer)  
**Test Date:** November 9, 2026  
**Scope:** Milestone 3 – Map, Search & Item Details (Issues #10, #11, #12)  
**Environment:** Local development server (`localhost:5173`), Chrome on macOS, Firebase Local Emulator Suite (Firestore + Auth), `main` at commit `377f2f5`

## 1. Overview

I tested the Milestone 3 features in the browser, including the campus map, item markers, keyword search, category filters, and the Borrow / Buy / Free item details pages. I checked the results against the GitHub Issue verification criteria and the requirements in our Requirements document.

All testing was done against the **local Firebase emulators**, not the production Firebase project. No production data, security rules, or configuration were changed.

**Setup checks**

| Check | Result |
|---|---|
| Local `main` updated to latest (`377f2f5`), no local changes | PASS |
| `npm run lint` | PASS – 0 errors, 1 warning (`AuthContext.jsx:74`, react-refresh rule) |
| `npm run build` | PASS – bundle-size warning only (848 kB) |
| App runs locally and signs in with a test `@uw.edu` emulator account | PASS |

**Test data (local emulator only)**

| Item | Type | Pickup area | Status | Purpose |
|---|---|---|---|---|
| Moving Cart | Borrow | West Campus | Active | Borrow marker and details |
| Desk Lamp ($15) | Buy | Suzzallo Library | Active | Buy marker, price, keyword overlap |
| MOVING Boxes ($5.50) | Buy | West Campus | Active | Case-insensitive search, shared pickup area |
| Rice Cooker (no photo) | Free | Odegaard Library | Active | Free details, missing photo |
| QA Test Desk Lamp | Free | HUB | Active | Created through the Give form |
| Old Mini Fridge | Borrow | HUB | **Inactive** | Hidden listing check |
| Expired Bike Lock | Free | IMA | Active, end date Nov 1 (**expired**) | Expired listing check |
| Chair A / B / C / X | Buy | Various | Active | Owners with 50 / 10 / 0 points / no user record (P5 ordering) |
| Bulk Item 0–199 | Mixed | All 8 areas | Active | Temporary – NF1 load test, deleted afterwards |

## 2. Testing Results

All results in the tables below come from **manual browser testing**. Items that were only reviewed in the code are marked **NOT TESTED** and explained in Section 3.

### Issue 3.1 – Map and Item Markers (#10)

**Result: PARTIAL PASS – Marker click behavior does not match F2.12–F2.14**

| Test | Requirement | Result |
|---|---|---|
| UW campus map loads | F2.1 | PASS |
| Each Active listing shows a marker (5 of 5) | F2.2 | PASS |
| Markers appear at the correct pickup areas | F2.3 | PASS |
| Marker colors match type (blue Borrow, yellow Buy, green Free) | F2.2 | PASS |
| Inactive listing (Old Mini Fridge) is not shown | LS2 | PASS |
| Expired listing (Expired Bike Lock) is not shown | LS2 | PASS |
| Clicking a marker opens a popup with name, type, price, pickup area, and "View item" link | – | PASS |
| Clicking a marker displays the item details page directly | F2.12–F2.14 | FAIL |
| Map loads with 7 listings – 286 ms | NF1 | PASS |
| Map loads with ~209 Active listings – 273 / 455 / 419 ms (3 runs) | NF1 | PASS (local emulator) |
| Map load time on production / campus Wi-Fi | NF1 | NOT TESTED |
| Production `pickupAreas` data contains all 8 areas | – | NOT TESTED |

**Notes:**

- Clicking a marker opens a popup first. The details page opens only after clicking "View item." The details page is reachable, but this is a two-step flow, while F2.12–F2.14 describe a direct one.
- When several listings share a pickup area, their markers are placed in a small circle around it. With ~26 listings per area (bulk test), the markers stack into one cluster and individual items are hard to click without zooming in.
- The NF1 test ran against the local emulator, not over campus Wi-Fi. Production load time is likely higher, but the measured times are far below the 3-second limit.

### Issue 3.2 – Search and Category Filters (#11)

**Result: PASS – one minor display bug**

| Test | Requirement | Result |
|---|---|---|
| Borrow filter shows only Borrow markers (1) | F2.4 | PASS |
| Buy filter shows only Buy markers (2) | F2.5 | PASS |
| Free filter shows only Free markers (2) | F2.6 | PASS |
| Clicking the selected filter again shows all markers (5) | F2.7 | PASS |
| Search "MOVING" returns Moving Cart and MOVING Boxes | F2.8 | PASS |
| Search "mOvInG" returns the same results (case-insensitive) | F2.8 | PASS |
| Search "lamp" shows a results list with both lamps | F2.9 | PASS |
| Results ordered by owner points: 50 → 10 → 0 → no user record | F2.9, P5 | PASS |
| P5 ordering still correct with the Buy filter selected | F2.9, P5 | PASS |
| Search "lamp" + Buy returns only Desk Lamp | F2.10 | PASS |
| Search "moving" + Free shows "No items found" | F2.11 | PASS |
| Search "zzzz" shows "No items found" | F2.11 | PASS |
| Search "fridge" (Inactive) returns no results | LS3 | PASS |
| Search "bike" (expired) returns no results | LS3 | PASS |
| Clearing the search removes the results list | – | PASS |
| Clicking a search result opens the correct details page | F2.15 | PASS |
| Search results appear within 1 second | NF2 | PASS |
| Price format in results list and popup matches the details page | – | FAIL |
| "No items found" when the system has zero listings | F2.11 | NOT TESTED |

**Notes:**

- Search runs when the user clicks "Search," not while typing.
- The results list only appears when a keyword is entered. Selecting a category alone filters the markers but does not show a list. This matches F2.9.

### Issue 3.3 – Item Details Pages (#12)

**Result: PASS for all tests completed**

| Test | Requirement | Result |
|---|---|---|
| Borrow details: photo, name, "Borrow", lender, pickup area, start/end date, time slot | B2.1–B2.8 | PASS |
| Buy details: photo, name, price ($15.00), "Buy", seller, pickup area, start/end date, time slot | S5.1–S5.9 | PASS |
| Free details: photo area, name, category, condition, "Free", giver, pickup area, start/end date, time slot | G6.1–G6.10 | PASS |
| Item without a photo shows a "No photo available" placeholder | – | PASS |
| Inactive Borrow item shows "This item is no longer available." | B2.14 | PASS |
| Expired Free item shows "This item is no longer available." | G6.26 | PASS |
| Non-existent item ID shows "This item could not be found." | – | PASS |
| Marker → popup → "View item" opens the correct item (Borrow, Buy, Free) | F2.12–F2.14 | PASS (two-step flow, see Issue 3.1) |
| Search result opens the correct item | F2.15 | PASS |
| No errors in the Chrome Console | – | PASS |
| Inactive Buy item shows "This item is no longer available." | S5.23 | NOT TESTED |
| "Send request!" button hidden for unavailable items | B2.15 | NOT TESTED |

**Notes:**

- S5.23 was not tested directly because the test data had no Inactive Buy listing. The same message logic was confirmed on Inactive Borrow and expired Free items.
- B2.15 could not be tested because the details page does not have a "Send request!" button yet. Requests belong to Milestone 4.

## 3. Bugs and Follow-Up

### Bugs Found (Browser Testing)

**1. Clicking a marker does not open the details page directly (F2.12–F2.14)**

- **Steps:** Open the Map page → click any marker.
- **Expected:** The item's details page opens.
- **Actual:** A popup opens. The details page opens only after clicking "View item."
- **Severity:** Medium. The feature works but does not match the requirement wording.
- **Follow-up:** The team should either navigate to the details page on marker click, or update F2.12–F2.14 to describe the popup step.

**2. Inconsistent price format**

- **Steps:** Search "moving" → check the MOVING Boxes entry in the results list and its marker popup → open its details page.
- **Expected:** The same price format everywhere.
- **Actual:** The results list and popup show "$5.5". The details page shows "$5.50."
- **Severity:** Low.
- **Follow-up:** Format prices with two decimal places in the popup and results list.

### Code Inspection Findings (Not Browser-Tested)

These were found by reading the code. They were not reproduced in the browser and are not counted as PASS or FAIL above.

| Finding | Related requirement | Notes |
|---|---|---|
| With zero listings in the system, searching or filtering shows "No items are available right now" instead of "No items found" | F2.11 | Rare edge case. The message condition checks for zero listings before checking for no matches. |
| Expired listings stay "Active" in the database until the owner opens their Manage page | F2.2, LS9 | The map and details page hide them correctly, but this conflicts with F2.2's literal wording ("each listing with status Active"). Suggest clarifying the requirement. |
| Pickup areas now load from Firestore. If production has only some valid area documents, listings at the missing areas will not appear on the map | F2.2, F2.3 | The app falls back to the built-in list only when no valid area exists. Confirm all 8 areas exist in production before closing #10. |

### Still Needs Testing

| Priority | Item | Follow-up |
|---|---|---|
| Medium | Production `pickupAreas` data | Confirm all 8 areas exist in the production Firestore |
| Medium | NF1 on production | Load the deployed map over campus Wi-Fi and time it |
| Low | S5.23 – Inactive Buy item message | Retest with an Inactive Buy listing |
| Low | B2.15 – "Send request!" button hidden when unavailable | Retest after Milestone 4 adds the button |
| Low | F2.11 – zero-listing edge case | Retest with an empty database |

## 4. Additional Observations

- Local `main` was 11 commits behind `origin/main` before testing and was fast-forwarded with no local changes. Team members testing locally should run `git pull` first.
- `.env.example` now defaults `VITE_FIREBASE_AUTH_DOMAIN` to `localhost`, which fixes the local sign-in error found during Milestone 2 testing.
- A GitHub Actions ESLint workflow (`.github/workflows/lint.yml`) was added. Whether it is set as a required PR check was not verified.
- All test data was created in the local emulator only and is cleared when the emulators stop. The 200 bulk listings were deleted after the NF1 test.

## 5. Overall Assessment

**Milestone 3 is largely complete. Search, filters, and item details passed all browser tests. Two requirement gaps remain.**

| Issue | Result |
|---|---|
| #10 – Map and Item Markers | PARTIAL PASS – marker click does not open details directly (F2.12–F2.14) |
| #11 – Search and Category Filters | PASS – minor price-format bug |
| #12 – Item Details Pages | PASS – S5.23 and B2.15 not yet testable |

Before closing these Issues, the team should:

1. Decide on F2.12–F2.14 (direct navigation or updated requirement wording).
2. Fix the price format in the popup and results list.
3. Confirm the production `pickupAreas` data.
4. Retest the NOT TESTED items listed above when possible.

**Related GitHub Issues:** #10, #11, #12
