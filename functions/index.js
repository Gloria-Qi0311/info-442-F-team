import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

initializeApp();

const db = getFirestore();

// Runs independently of either user's browser. Replays and retries are safe
// because the per-user point records are checked inside a transaction.
export const awardBorrowingCompletionPoints = onDocumentUpdated(
  { document: 'requests/{requestId}', region: 'us-west1', retry: true },
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.stage === 'Received'
      || after.stage !== 'Received' || before.stage !== 'Return'
      || after.status !== 'Approved' || after.listingType !== 'lend'
      || !after.ownerId || !after.requesterId
      || after.ownerId === after.requesterId) return;

    const requestId = event.params.requestId;
    const participants = [[after.ownerId, 10], [after.requesterId, 5]];
    await db.runTransaction(async tx => {
      const refs = participants.map(([uid]) => ({
        uid,
        user: db.doc(`users/${uid}`),
        record: db.doc(`pointsRecords/${requestId}_${uid}`),
      }));
      // Read all documents before any write (Firestore transaction requirement).
      const snapshots = await Promise.all(refs.map(({ record }) => tx.get(record)));
      for (let i = 0; i < refs.length; i += 1) {
        const { uid, user, record } = refs[i];
        const recordSnap = snapshots[i];
        if (recordSnap.exists) continue;
        const points = participants[i][1];
        tx.set(user, {
          totalPoints: FieldValue.increment(points),
          lastPointsRequestId: requestId,
        }, { merge: true });
        tx.create(record, {
          requestId, userId: uid, points,
          reason: 'Completed borrowing transaction',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });
  },
);
