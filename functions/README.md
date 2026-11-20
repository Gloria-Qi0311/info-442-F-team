# Automatic lending completion points (P1/P2/P4)

The `awardBorrowingCompletionPoints` Firestore trigger runs when a lending request
moves from `Return` to `Received`. It awards **+10** to the lender and **+5**
to the borrower without either person opening a completion page.

Each user has a deterministic `pointsRecords/{requestId}_{uid}` record.
The trigger uses a Firestore transaction, checks that record before awarding,
and uses `FieldValue.increment`. Duplicate delivery and retries do not
award points twice. Existing points records from earlier versions are honored.

## Deployment required

**Merging the pull request does not deploy this backend.** The Firebase project
must support Cloud Functions (usually the Blaze billing plan). From a trusted
developer machine with access to the correct Firebase project:

```sh
npm install --prefix functions
npx firebase deploy --only functions:awardBorrowingCompletionPoints
```

Deploy the existing Firestore and Storage rules separately when needed.
Confirm the trigger is deployed in the **same Firebase project** used by the app.

Test with two verified UW accounts: borrower confirms return, lender confirms
receipt, then verify both `pointsRecords` and both `users.totalPoints`
without opening the completion pages. Reopen pages and confirm totals do not
increase. Verify that a retry does not award points again.

**Existing Received requests:** the trigger is event-driven and does not
automatically backfill transactions completed before deployment. A one-time
administrative backfill would be needed for those.
