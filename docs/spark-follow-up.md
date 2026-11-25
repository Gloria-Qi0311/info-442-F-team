> Historical QA record. The LS4 limitation described below is superseded by [the approval-epoch migration](LS4-security-limitation.md); unrelated historical findings are not reclassified by this fix.

# PR #69 Spark follow-up

Firebase Console inspection on 2026-11-23 confirmed `info442-husky-share`, the default Firestore database in `nam5`, and Spark ($0/month). The Data panel listed healthChecks, listings, pickupAreas and requests; no ratings collection was shown at inspection time. The published Rules history showed a latest version at 11:30 PM. No production data, rules or billing settings were changed during this work.

## Implemented

- R8: rating creation and `ratingSummaries/{rateeId}` are one transaction. The summary stores ratingTotal, ratingCount, rounded overallRating and lastRatingId. Rules require both writes, validate the increment against the new rating, and prohibit standalone edits and replay. Summary documents are separate from self-editable user profiles. Request cards use the persisted summary, retaining a historical read fallback until migration.
- LS9: use America/Los_Angeles calendar dates, including the entire last millisecond of the available day. A paginated Admin SDK worker rechecks each listing in a transaction before marking it Inactive, preserving concurrent approvals or edits. The proposed hourly GitHub Actions workflow uses the same existing secret as deployment, without Firebase Cloud Functions or a billing upgrade.
- LS4: the approval helper now also rejects expired listings. The existing atomic UI approval and request-version checks remain. The direct-SDK omission problem remains unresolved; see LS4-security-limitation.md. This PR is not complete LS4 compliance.
- Integrate main's #68/#70 changes into this PR, resolve conflicts, retain cancellation error wording and share the timeout helper. Node's navigator without onLine no longer incorrectly means offline.

## Validation

Local Firestore emulator: 32 tests passed, including missing-summary rejection, forged totals, duplicate ratings, half-up rounding, competing stale updates, giveaway rating and expiry without a visitor. Date tests: 3 passed, including summer, winter and daylight-saving boundaries. Lint and build passed (existing Fast Refresh and bundle-size warnings).

## Rollout gates — do not merge yet

1. Review/validate this PR's latest CI and two-account browser flows. Rules tests are not a substitute for browser acceptance.
2. Pause rating submissions for rollout. Inspect legacy ratings and run `GCLOUD_PROJECT=info442-husky-share node scripts/backfill-rating-summaries.js` with the existing authorized deployment identity (dry-run). If records exist, validate them and rerun with `--apply` before enabling the new rating flow. New submissions refuse to silently discard legacy totals when a summary is absent.
3. Deploy the new frontend and rules together during that maintenance window. Deploying these rules alone breaks old clients' rating writes; deploying the frontend alone cannot write summaries under old rules. No deployment has been performed here.
4. Confirm the existing service account can read/write Firestore documents before enabling the expiry workflow. No new identity, credential or IAM grant was created. The workflow is only proposed on this PR branch: scheduled workflows run from the default branch, so it is not active yet.
5. GitHub schedules may be delayed or dropped and public-repository schedules can be disabled after 60 days without activity. Hourly expiry is eventual persistence, not an exact-midnight guarantee. The existing client rule conservatively uses UTC+8 and may delay its best-effort summer write by an hour; the worker uses the correct Seattle date. The worker scans active listings hourly, consuming Spark read/write quota.
6. Resolve LS4's direct-SDK invariant before full acceptance. Do not treat all passing tests or the proposed worker as permission to merge.

GitHub's standard hosted runners are free for this public repository: https://docs.github.com/en/actions/concepts/billing-and-usage
Scheduling constraints: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
