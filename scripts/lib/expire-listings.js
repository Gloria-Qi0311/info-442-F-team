import { FieldPath } from 'firebase-admin/firestore';
import { isPastAvailability } from '../../src/data/availability.js';

// Page through active listings and recheck each candidate inside a transaction:
// an approval or availability edit after the scan must never be overwritten.
export async function expireListings(db, now = new Date()) {
  let cursor;
  let expired = 0;
  for (;;) {
    let query = db.collection('listings').where('status', '==', 'Active')
      .orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) return expired;
    for (const candidate of page.docs) {
      if (!isPastAvailability(candidate.data(), now)) continue;
      const changed = await db.runTransaction(async tx => {
        const current = await tx.get(candidate.ref);
        if (!current.exists || current.data().status !== 'Active' || !isPastAvailability(current.data(), now)) return false;
        tx.update(candidate.ref, { status: 'Inactive' });
        return true;
      });
      if (changed) expired++;
    }
    cursor = page.docs.at(-1);
  }
}
