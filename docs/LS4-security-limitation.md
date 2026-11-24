# LS4 — request consistency review (Issue #16)

The normal owner approval helper `decideItemRequest` reads pending requests, checks the listing request version, and updates all known pending requests and the listing in a Firestore transaction. The request page also invokes `reconcilePendingRequests` to repair stale Pending requests.

**Known limitation:** Firestore Security Rules evaluate documents referenced by a write; they cannot query and atomically require updates to *every* document matching a collection query. An owner using the Firebase SDK directly can approve request A and update the listing while leaving request B Pending. A client-only change or extra UI validation cannot make this a server-enforced invariant. Do not claim LS4 is fully protected against direct SDK calls.

**Decision needed from PM/instructor:** If LS4 must hold even for direct SDK writes, move approvals into a trusted Cloud Function or other backend transaction, and reject direct owner approvals in Security Rules. If MVP scope is limited to the supported UI flow, record the limitation explicitly and retain the existing transaction, request-version checks, and reconciliation.

**Regression checks:** use two pending requests for one listing; approve A through the UI; verify A Approved, B Declined, listing no longer Active. Repeat with a request arriving during approval and verify the owner is asked to refresh. Also test direct SDK approval separately and report it as the known backend limitation, not as a passing case.
