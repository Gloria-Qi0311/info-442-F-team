# Milestone 4 — QA Testing Report

**Project:** Husky Share — UW INFO 442  
**QA Coordinator:** Stella Sun (Product Manager)  
**Test Execution:** Stella Sun (manual production walkthrough); Codex (independent local Firebase Emulator testing)  
**Baseline Test Date:** November 22, 2026 (Pacific Time)  
**Follow-up Status Checked:** November 23, 2026 (Pacific Time)  
**Scope:** M4 — Requests & Approval Workflow; Issues #13, #14, #16, and #17  
**Baseline Commit:** `f38b591163bfa0a8f9d627b9f96f5e0e6860adff`  
**Overall Result:** **PARTIAL PASS — Fixes merged; targeted retesting and requirement decisions pending**

## 1. Overview

The core Borrow, Buy, and Free request workflows worked in Codex's local test environment. This included valid submission, required-field and date validation, Pending/Canceled state changes, resubmission, duplicate and own-listing protection, owner approval/decline, pickup validation, listing status updates, and ordinary notification-count behavior.

Stella also manually tested the Borrow request and Manage flows on the live site, including submitting and canceling a TI-84 Calculator borrowing request, confirming cancellation persistence, and navigating from Manage to the request page. These PM observations are **separate** from Codex's local emulator results.

**M4 is not yet fully accepted.** The November 22 baseline found requirement differences in ratings, feedback tags, request error messages, approved-request links, and unread-count semantics, plus a Firestore rules-level consistency gap (LS4). Some failure-handling UI branches were not completed. Fixes landed on November 23, but the original failing cases have **not yet been marked PASS by a post-fix retest**.

## 2. Test Environment and Evidence

| Area | Environment / result |
| --- | --- |
| PM manual walkthrough | Production Husky Share website; limited Borrow/Manage flows |
| Codex functional testing | Local Vite application; Firebase Auth/Firestore emulators using `demo-husky-share` |
| Browser test cases | 23 executed cases: **17 PASS, 5 FAIL, 1 BLOCKED** |
| Application-helper checks | **55/55 PASS** after correcting two test-harness assertions |
| Concurrency and canceled-approval checks | **8/8 PASS** |
| Cancellation endpoint-failure data checks | **3/3 PASS** |
| Existing Firestore rules suite | **18/18 PASS** after locally installing the CI-style test dependency |
| Lint | **PASS:** 0 errors, 1 existing warning in `AuthContext.jsx` |
| Build | **PASS:** bundle-size warning only |

**Requirements coverage:** The Codex baseline mapped 124 core M4 clauses plus 10 linked/shared clauses (**134 total**): **108 PASS, 14 FAIL, 11 NOT TESTED, 1 BLOCKED**. These are baseline results against the November 22 commit, **not** current acceptance counts after subsequent fixes.

**Evidence boundary:** Codex reported local logs and JSON test artifacts (for example `sdk-results.json`, `browser-observer-log.json`, and `requirements-matrix.json`). These artifacts were referenced in its supplied draft but were **not attached to this report or found under `m4-evidence/` on the GitHub main branch**. The detailed requirement-by-requirement matrix remains in the supplied Codex draft. This report does not claim those files are committed.

## 3. QA Results by Issue

| Issue | Core behaviors tested | Baseline assessment |
| --- | --- | --- |
| **#13 — Borrow Requests** | Form opens; missing/invalid dates rejected; valid request becomes Pending; cancellation persists; resubmission and duplicate prevention work; request details and elapsed time display | **PARTIAL PASS:** core flow passed; rating/tag and failure-message differences, plus UI test gaps |
| **#14 — Purchase and Giveaway Requests** | Buy/Free send, cancel, reload, resubmit; owner incoming lists; own-listing restrictions; unavailable items protected | **PARTIAL PASS:** core flows passed locally; rating/tag and failure-message differences; cancellation-error UI not confirmed |
| **#16 — Request Approval and Status Updates** | Owner approve/decline; required pickup details; other Pending requests declined by normal workflow; listing becomes On Loan/Sold/Given Away; race tests passed | **PARTIAL PASS:** ordinary workflow passed; direct-SDK LS4 consistency gap and certain stale-request UI branches remain |
| **#17 — Sent Requests and Unviewed Count** | Manage shows sent request types/statuses; usual Pending unread add/view/reload behavior works | **PARTIAL PASS:** approved-request navigation and Pending-only unread-count behavior differ from stated requirements |

The PM's live Borrow/Manage checks support parts of #13 and #17. Codex's Buy/Free, approval, race, and simulated-outage results come from **local emulators**, not from production purchases or production data changes.

## 4. Findings and Developer Follow-up

| ID | Severity | Requirement / issue | Baseline finding (Nov 22) | Follow-up status (Nov 23) |
| --- | --- | --- | --- | --- |
| **M4-01** | Medium | R8; L4.2, S3.12, G3.11; #13/#14 | Incoming request cards showed `4.5 / 5 stars` instead of a whole-star rounded value | Rating-display changes included in merged PR #60; **retest needed** |
| **M4-02** | Medium | R13; L4.3, S3.13, G3.12; #13/#14 | Four equally frequent feedback tags displayed; requirement caps display at three | **Retest / confirm fix needed**; do not assume PR #60 fully addresses the cap |
| **M4-03** | Low | H10; #17 | Approved requests on Manage linked directly to ongoing transactions instead of specified B4/S5/G6 pages | Request-link fix included in merged PR #61; **retest needed** |
| **M4-04** | Low — clarify | H4; #17 | Count excluded Canceled-but-unviewed requests by counting only unviewed Pending requests | PR #61 explicitly left Pending-only counting unchanged; **PM requirements decision needed** |
| **M4-05** | Low | B3.12, S5.24, G6.27; #13/#14 | Failed submission displayed generic `Connection failed.` rather than saying the request could not be sent | Request-specific error handling included in merged PR #61; **retest needed** |
| **M4-06** | Medium — data integrity | LS4; #16 | A direct authenticated-owner Firestore batch could approve A and mark the listing Sold while B remained Pending | **Open for design/security review**; ordinary application and concurrency flows passed |

**Additional defense-in-depth observation:** An authenticated requester could bypass normal form validation using a direct SDK request with invalid Borrow dates/blank fields, while the application helper correctly rejected those values. PR #61 added Firestore validation for Borrow submissions. Treat that as a **reported fix pending independent retest**, not as proof that every invalid-write path is now protected.

**Clarification:** LS4 is a rules-level invariant finding; it does **not** mean the normal approval UI was broken. Likewise, H4 may be an intentional product decision, but it should be explicitly approved or the requirements updated before acceptance.

## 5. Notable PASS Evidence

| Area | Baseline evidence |
| --- | --- |
| Borrow request | Valid request showed Pending; dates/preferences/purpose persisted; canceled status survived refresh |
| Buy / Free requests | Send, cancel, reload and resubmit worked; canceled requests were removed from owner Pending lists |
| Owner decisions | Approvals and declines updated request and listing statuses correctly in normal workflow |
| Pickup validation | Missing date/time/location and past dates were rejected |
| Access controls | Own-item request buttons hidden; unrelated user could not access another owner's incoming request page |
| Concurrency | Three simultaneous approval runs, three approval/new-request races, and two canceled-approval guards passed |
| Notifications | New unviewed Pending request increased count; owner view reduced count and persisted viewed flag |
| Failure persistence | Simulated send failures did not create new requests; failed cancellation data-layer checks retained Pending |

## 6. Remaining Test Coverage

| Test / requirement | Status | Next action |
| --- | --- | --- |
| B2 Pending display/link (B2.12–B2.13) | NOT TESTED fully | Open item details while request is Pending and verify status plus link |
| All required-field UI messages (B3.5) | Partial; helper checks PASS | Verify each missing-field error in browser |
| Manage listing-card navigation (L3.10) | NOT TESTED fully | Click a listing with Pending requests and verify L4 |
| Canceled-request approval UI errors (L4.17/S3.24/G3.24) | NOT TESTED fully | Test stale owner controls after requester cancellation |
| Cancellation-error UI message (B4.8/S5.18/G6.19) | Borrow BLOCKED; Buy/Free NOT TESTED | Test failure message manually in safe local emulator |
| Approved-request Manage links (H10) | Fix merged, retest pending | Retest Borrow/Buy/Free approved links |
| Submission error messages | Fix merged, retest pending | Trigger controlled local network failures and inspect message |
| Rating rounding and tag limit | Retest pending | Use seeded 4- and 5-star ratings plus four tied tags |
| Unviewed count of canceled requests (H4) | Requirements clarification pending | PM confirms whether only actionable Pending requests count |
| LS4 direct-SDK invariant | Design review pending | Decide whether authoritative enforcement is needed and add negative rule test |
| Production end-to-end approval | Not independently covered by Codex | Obtain permission and use designated test accounts/data for later smoke testing |

## 7. Post-baseline GitHub Changes

The following PRs were **merged after** the November 22 baseline testing:

- **PR #60 — Fix M4/M5 QA: missing profiles, confirmation photos, ratings display:** merged November 23, 2026 (Pacific Time).
- **PR #61 — Fix M4 QA: borrow validation, request links, error messages, save timeouts:** merged November 23, 2026 (Pacific Time).

These merges demonstrate development follow-up, **not verified post-fix PASS results**. All relevant outcomes above remain pending until a targeted retest is recorded. Neither PR automatically closes the LS4 or H4 requirements questions.

## 8. Overall Assessment and Sign-off

**Decision: PARTIAL PASS / ACCEPTANCE PENDING.**

M4's ordinary request and approval workflows are largely functioning in the tested local environment, and PM smoke testing confirmed key Borrow/Manage behavior on the live website. The team has merged follow-up fixes for several identified issues.

Before full acceptance, the PM should (1) retest the merged changes, (2) resolve H4's wording/intent, (3) decide the required enforcement boundary for LS4, and (4) finish the remaining UI-specific validation branches. Do not mark the four M4 Issues as completely verified solely on the strength of successful core workflows.

### Relevant GitHub Records

- [Issue #13 — Borrow Requests](https://github.com/Gloria-Qi0311/info-442-F-team/issues/13)
- [Issue #14 — Purchase and Giveaway Requests](https://github.com/Gloria-Qi0311/info-442-F-team/issues/14)
- [Issue #16 — Request Approval and Status Updates](https://github.com/Gloria-Qi0311/info-442-F-team/issues/16)
- [Issue #17 — Sent Requests and Unviewed Count](https://github.com/Gloria-Qi0311/info-442-F-team/issues/17)
- [PR #60 — M4/M5 QA Fixes](https://github.com/Gloria-Qi0311/info-442-F-team/pull/60)
- [PR #61 — M4 QA Fixes](https://github.com/Gloria-Qi0311/info-442-F-team/pull/61)

*Report prepared from the PM's manual test observations, Codex's November 22 M4 QA draft, and verified GitHub PR status. No repository files or production data were modified in preparing this document.*
