# LS4 — atomic approval epochs (Issue #16)

Source: [original Requirements](https://app.notion.com/p/Requirements-401154ba926580a4bc2dfdf427232e5c), reread November 24, 2026. LS4 requires every other pending request to become Declined on approval; NF9 requires no partial saves on failure.

## Persisted status contract, version 2

The former independent `requests.status = Pending` documents allowed a direct SDK caller to omit rivals. Version 2 removes that duplicated Pending field. The authoritative request status is the pair of its request document and its listing:

- An explicit terminal `status` is Approved, Canceled or Declined.
- An undecided request has **no status field**, and stores immutable `requestEpoch`.
- Equal `requestEpoch` and `listing.approvalEpoch` means Pending.
- A smaller requestEpoch means Declined permanently, even after a loan reopens.

An approval writes the selected request's Approved decision and advances the listing epoch exactly once in the **same transaction**. That persisted epoch commits the Declined decision for every rival at once. This is a normalized data model, not a UI-only filter or an eventual repair worker. SDK integrations must use this status contract (`src/data/requestStatus.js`), not query `where('status', '==', 'Pending')`. Raw rivals do not contain stale Pending values. Terminal Approved documents retain their shape for pickup, return, points and ratings.

Rules enforce the same epoch predicate. A caller cannot approve without advancing the epoch, advance the epoch without a matching winner, alter a request's epoch, create a request during closure, or resurrect an implicitly declined request. Listing deletion is denied to prevent delete/recreate from resetting epochs; there is no application listing-delete flow. H4's unviewed query and viewed-state updates remain unchanged.

Approval always writes two documents, independent of rival count. It needs no Cloud Functions, paid scheduler, or Blaze upgrade. Ordinary Firestore Spark quotas still apply; unavailable writes fail atomically.

## Existing data and rollout

`node scripts/migrate-request-epochs.js` is a read-only preflight by default. It validates associations, rejects orphan/ambiguous legacy data, and reports counts without printing request contents. The PR preflight checks the existing production dataset before merge.

Deployment order: preflight → new rules → `--apply` migration → new Hosting app. Legacy request creation and decisions are blocked by the new rules until each listing receives `requestSchemaVersion: 2`. Terminal transactions and H4 remain available. A brief request-maintenance window is expected; old open browser tabs must refresh after deployment.

Migration removes legacy Pending fields and sets requestEpoch 0. An empty legacy Unavailable listing is preserved without inventing a winner. An already-approved listing with requests starts at epoch 1, repairing old Pending stragglers; an unapproved listing starts at 0. Existing Approved/Canceled/Declined decisions, identity, pickup details and viewed flags are preserved. Per-request transactions make large migrations resumable without a batch-size limit. A listing is marked ready only after its requests are converted. Re-running skips ready listings. Never run the apply step before deploying the new rules, and do not roll back to the old rules/client after migration.

## Verification scope

Automated coverage includes actual approval helper for all three listing types; the original SDK omission without an epoch (rejected, no changes); direct SDK epoch approval with 60 rivals (all Declined); competing approvals; submission/cancellation races; forged epoch and multiple-winner writes; loan reactivation; input failure and offline transaction rollback; migration dry-run/idempotence; and H4 preservation. Client integration tests exercise the actual submit, cancel, resubmit, request-reader and live-listener functions.

These checks do not claim a fresh manual browser pass for every unrelated requirement. The broader original Requirements checklist remains outside this targeted fix; untested requirements must not be marked PASS.
