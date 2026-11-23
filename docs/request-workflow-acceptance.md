# Request workflows — verification checklist

This checklist covers Issue #13 and #16, and the linked B5–B8 / L5–L8 continuation. **Do not mark browser checks complete solely because CI passes.**

## Automated checks (GitHub Actions)

- Firestore Rules emulator: `npm run test:rules` via `firebase emulators:exec`
- Lint: `npm run lint`
- Build: `npm run build`

The Firestore test suite covers UW authorization, request creation/cancellation, approval and decline, type-specific listing statuses, atomic request-version changes, pickup/return transitions, completion points, and rating authorization.

## Browser acceptance checks (two separate verified UW accounts)

1. Owner lists a lending item with future availability.
2. Borrower opens B2, sends a B3 request, sees B4 Pending and elapsed time.
3. Borrower cancels; owner L4 removes Pending without a refresh.
4. Borrower re-submits; owner sees the request and the borrower's rating/tags.
5. Owner clicks Approve and enters pickup date/time/location; missing and past date must show errors without approving.
6. Owner approves; other Pending requests become Declined; listing becomes On Loan; lender navigates to L5.
7. Borrower sees B4 Approved and follows B5 link. Both pages show the same pickup information and Approved timeline.
8. Borrower uploads a pickup photo on B6; both timelines remain Approved until lender confirms on L6.
9. Lender uploads pickup photo; both timelines become Pickup.
10. Borrower uploads return photo on B7; both timelines become Return.
11. Lender uploads return photo on L7; both timelines become Received.
12. Both parties open their Return Complete pages; lender earns 10 points, borrower earns 5, and both can rate the other once.
13. Repeat the rating and points pages: no duplicate ratings or point awards.
14. Test upload failure, offline save, invalid image, direct URL access as the wrong user, and reload during every stage.
15. Check selling and giveaway request approvals separately: status Sold or Given Away; requester's approval details are visible.

## Deployment / integration

- The Firestore and Storage rules in this branch must be deployed to the intended Firebase project by an authorized maintainer before real-account testing. CI's emulator uses repository rules, but it does not deploy them.
- Do not merge PR #54 or change production rules without the team's approval.
- Complete browser checks in a safe test project with two verified UW accounts; record screenshots and failures before calling the work fully accepted.
