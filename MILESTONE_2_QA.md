# Milestone 2 – QA Testing Report

**Project:** Husky Share – INFO 442  
**Tester:** Stella Sun (Product Manager)  
**Test Date:** November 9, 2026  
**Scope:** Milestone 2 – Item Listing & Management  
**Environment:** Local development server (`localhost:5173`), Chrome, Firebase

## 1. Overview

I tested the main features in Milestone 2, including item listing forms, photo uploads, listing submission, and Manage Listings pages.

Most of the basic form and navigation features worked as expected. However, I found an issue with Firebase Storage when submitting a listing with a photo. The upload request failed, and the page stayed on "Saving..." without showing an error or moving to the confirmation page.

I documented the results in the related GitHub Issues.

## 2. Testing Results

### Issue 2.1 – Build Item Listing Forms (#6)

**Result: PASS for the basic tests completed**

| Test | Result |
|---|---|
| Lend form loads correctly | PASS |
| Lend form shows errors for missing required fields | PASS |
| Lend form prevents invalid date ranges | PASS |
| Date validation errors clear after correcting inputs and continuing | PASS |
| Sell form basic validation and navigation | PASS |
| Give form shows errors for missing required fields | PASS |

**Notes:**

- All three listing forms were accessible.
- The Lend form prevented users from continuing with missing required information.
- The date picker prevented the start date from being later than the selected end date.
- No problems were reported during the basic Sell form check, although detailed price validation was not separately documented.
- The Give form uses "Next," while Lend uses "Continue." This is a minor UI consistency suggestion, not a blocking issue.

### Issue 2.2 – Implement Photo Upload (#7)

**Result: PARTIAL PASS – Upload failure found**

| Test | Result |
|---|---|
| Select a valid image file | PASS |
| Display image preview | PASS |
| Replace an image and update the preview | PASS |
| File picker restricts PDF and other non-image files | PASS |
| Complete an actual Firebase Storage upload | FAIL |
| Display an error when the upload fails | FAIL in the observed submission |

**Issue found:**

I selected a valid PNG image in the Give listing form. The image preview displayed correctly, but submitting the listing triggered Firebase Storage request errors in Chrome Console.

The Console showed:

- `Access to XMLHttpRequest has been blocked by CORS policy`
- `POST ... net::ERR_FAILED`

The page remained on "Saving..." instead of reporting an upload failure.

The underlying cause still needs investigation. The error may be related to Firebase Storage configuration or permissions, but this has not been confirmed.

**Follow-up:** Review the Firebase Storage upload setup and error handling, then retest.

### Issue 2.3 – Implement Listing Submission and Confirmation (#8)

**Result: FAIL in the tested Give submission flow**

**Test case:** Submit a Give listing with all required fields completed and a valid PNG image.

**Test item:** `QA TEST - Water Bottle`

**Expected result:**

- The listing is saved successfully with Active status.
- The user reaches the confirmation page.
- The confirmation page displays the submitted information.
- Failed submissions display an error without losing entered information.

**Actual result:**

- The submit button changed to "Saving..." and did not complete.
- The confirmation page did not appear.
- Chrome Console showed Firebase Storage request failures.
- I checked the three documents visible in Firestore's `listings` collection. None matched the test item.
- The entered form information remained visible.
- No clear error message was displayed to the user.

**Follow-up:** Retest successful submission, Active status, and the confirmation page once the upload issue has been resolved.

### Issue 2.4 – Build Manage Listings Pages (#9)

**Result: PASS for the basic tests completed**

| Test | Result |
|---|---|
| My Lending Listings page loads | PASS |
| My Selling Listings page loads | PASS |
| My Giveaway Listings page loads | PASS |
| Search fields are displayed | PASS |
| Empty listing messages display correctly | PASS |
| Searching with no matching listings shows the correct message | PASS |
| Display and search actual listings owned by the signed-in user | NOT TESTED |
| Automatically mark expired listings as Inactive | NOT TESTED |

**Notes:**

The three Manage Listings pages loaded correctly. On the Lending page, searching for "Notebook" changed the empty-state message to "No listings match your search."

I also checked the Selling and Giveaway pages and did not encounter problems with their basic page displays.

I could not fully verify listing search results or expired listing behavior because the test listing submission was unsuccessful.

## 3. Main Issues and Follow-Up Items

| Priority | Issue | Follow-up |
|---|---|---|
| High | #7 – Firebase Storage upload failure | Investigate failed upload requests and retest |
| High | #8 – Listing submission stuck on "Saving..." | Add reliable failure handling and verify successful submission |
| Medium | #9 – Actual listing search and expired status not tested | Retest when suitable listings are available |
| Low | #6 – Inconsistent button wording | Consider using the same wording across listing forms |

## 4. Additional Observations

- The local app loaded successfully after updating the project dependencies with `npm install`.
- The new map dependency loaded correctly.
- Firestore now shows a `pickupAreas` collection. Its contents and behavior were not verified during this round.
- The installation reported 20 dependency vulnerability advisories (16 moderate, 4 high). No dependency security fixes were applied during testing.

## 5. Next Steps

Once the Firebase Storage issue is fixed, I will:

1. Retest photo upload and error handling.
2. Submit a test listing and verify its Firestore record and Active status.
3. Check that the confirmation page displays the correct information.
4. Verify that the listing appears under the correct Manage Listings page.
5. Test searching existing listings and handling expired listings.
6. Update this report and the related GitHub Issues with the new results.

## 6. Overall Assessment

**Milestone 2 is partially verified, but the full listing submission workflow has not passed QA.**

The basic listing forms, photo previews, and Manage Listings pages worked in the tests completed. However, the Firebase Storage upload failure blocks successful submission and confirmation testing.

The remaining checks should be completed after the upload issue is resolved.

**Related GitHub Issues:** #6, #7, #8, #9