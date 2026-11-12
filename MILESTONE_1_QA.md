# Milestone 1 — QA Testing Report

**Project:** Husky Share — INFO 442  
**Tester:** Stella Sun (Product Manager)  
**Date:** November 6, 2026  
**Scope:** Milestone 1 — App Setup, User Verification & Navigation

## 1. Overview

I tested the Milestone 1 features locally on my Mac and reviewed the Firebase project configuration to check whether the implementation meets our verification criteria.

The main user flows worked as expected, including UW Google sign-in, sign-out, navigation, and access to the listing pages. I also found a Firestore security rules issue and identified a few items that still need follow-up.

## 2. Test Results

| Issue | Test | Result |
|---|---|---|
| 1.1 | Install dependencies and run the application locally | PASS |
| 1.1 | Production build (`npm run build`) | PASS |
| 1.1 | ESLint (`npm run lint`) | PASS — 0 errors, 1 warning |
| 1.1 | Firestore test data visible in Firebase Console | PASS — existing records confirmed |
| 1.1 / NF7 | Unauthenticated read of `healthChecks` | FAIL |
| 1.1 / NF6 | HTTPS hosting deployment | NOT VERIFIED |
| 1.1 | App-side database save and read-back | NOT TESTED |
| 1.2 | UW Google sign-in redirects to Map | PASS |
| 1.2 | Sign-out redirects to Verification | PASS |
| 1.2 | Direct access to `/map` after sign-out redirects to `/verify` | PASS |
| 1.2 | Non-UW account rejection | NOT TESTED |
| 1.3 | Map, Manage, and My Account navigation | PASS |
| 1.3 | Manage links to lending, selling, and giveaway pages | PASS |
| 1.3 | My Account displays the signed-in user's name and UW email | PASS |
| 1.3 | Navigation bar hidden on Verification page | PASS |
| 1.4 | Post Items button opens Post an Item page | PASS |
| 1.4 | Lend, Sell, and Give options open the correct forms | PASS |

## 3. Issues and Follow-Up

### NF7 — Firestore Security Rules

I used Firebase Rules Playground to simulate an unauthenticated user reading a document in the `healthChecks` collection.

- **Expected:** Access denied
- **Actual:** Simulated read allowed
- **Finding:** The deployed rules contain `allow read: if true;`, while the repository version requires `isUwUser()`.
- **Next step:** Coordinate an update to the deployed rules and rerun the test to confirm that unauthenticated access is denied.

Finding documented in GitHub Issue #2.

### NF6 — HTTPS Deployment

Firebase Hosting currently displays the initial setup page, with no deployed website listed.

- **Status:** Not verified
- **Next step:** Confirm whether the application has been deployed through another hosting service. If not, arrange an HTTPS deployment and verify the published site.

### Additional Checks

- ESLint completed with 0 errors and 1 warning in `AuthContext.jsx`.
- The production build succeeded, with a warning about JavaScript bundle size.
- The existing Firestore data includes `healthChecks` and `listings`, but I did not find a `pickupAreas` collection.
- Database save/read-back functionality still needs to be tested from the application.

## 4. Summary

The tested authentication and navigation flows for Milestone 1 passed. The remaining work is mainly related to database setup, security rules, deployment verification, and a few tests that have not yet been completed.

I will update the report as the remaining issues are resolved and retested.


## 5. Follow-up Retesting (November 9–11, 2026)

I followed up on the issues identified in my original M1 QA testing and verified the fixes after the team made updates.

| Test | Retest Result | Notes |
|---|---|---|
| NF6 – HTTPS Hosting | PASS | The application is accessible at https://info442-husky-share.web.app. |
| NF7 – Firestore Security Rules | PASS | An unauthenticated read of `healthChecks` was denied in the Firebase Rules Simulator. |
| Database Read/Write | PASS | Successfully saved and retrieved a test document using `/dev/db-check` on November 9. |
| Pickup Areas | PASS – initial data present | Confirmed that the production Firestore `pickupAreas` collection contains all 8 expected documents. The HUB document's name and coordinates were checked. |
| NF10 – Automated ESLint | PASS | GitHub Actions runs ESLint successfully on pull requests and pushes to `main`. |
| NF10 – Required PR Check | CONFIRMED CONFIGURED | GitHub displays `lint` as a required check on PR #33. The PR's own check still needs to run before merging. |

### Remaining Verification

- Non-UW account rejection was not independently tested in the original M1 QA.
- The latest Sign Out navigation change should receive a final regression test.

### Retest Summary

The original NF6, NF7, and database read/write issues passed follow-up testing. The initial pickup area data is now present in Firestore, and the repository has an automated required ESLint check.

The original test results above have been preserved as a record of the issues found during initial QA. These follow-up results document what was verified after the fixes.
