# @lwang45 — Sprint 1/2 QA follow-up

- **#13 / B4.8**: cancellation now has a clear failure message and offline/timeout protection in BorrowRequestStatus and ItemDetails. The UI waits for a confirmed result; a timeout is ambiguous and requires refreshing before retrying.
- **#16 / LS4 (F-07)**: the supported owner UI uses a transaction, requestVersion, and reconciliation. Direct SDK writes remain a known cross-document security-rule limitation; see LS4-security-limitation.md. A trusted backend is required to enforce the invariant for arbitrary clients.
- **F-08 / L3.10**: Manage listing cards show View requests only when pending count is nonzero.
- **F-09 / PH2–PH4**: pickup/return confirmation file selection now immediately checks file type and the 10 MB limit. PH2 itself requires a photo preview; PH3 covers non-image errors and PH4 upload failure messages.
- **F-10 / R14**: cards omit the feedback-tag section when there are no tags. This is consistent with the QA finding, but PM should confirm desired empty-state wording.
- **F-13 / R8**: original R8 says the rated user's overall rating is set to the rounded average when a rating is submitted. The current implementation calculates this on reads rather than persisting an aggregate, which scales linearly with rating count. Replacing it with transactional aggregate counters requires migration and careful concurrency rules, so it is not claimed as fixed here.
- **F-14 / LS9**: expiration is currently checked on listing reads and updated by clients. Guaranteed server-side expiration requires a scheduled backend process. This is not claimed as fixed.
- **F-15 / #12**: removed the unreachable nested owner branch in ItemDetails while preserving the borrower-specific UI.

**Testing:** GitHub CI executes Firestore emulator rules tests, ESLint, and Vite build. These are not a substitute for a two-account browser end-to-end run, an offline browser test, or a malicious SDK test. Do not mark the backend limitations as passing without a server-side implementation.
