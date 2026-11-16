import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_STATUS, REQUEST_STATUS } from './schema';

// Approve or decline a request. Only the listing owner may make this decision.
// All known pending requests are updated in the same transaction as the listing.
export async function decideItemRequest(requestId, ownerId, decision, pickup = {}) {
  if (!['approve', 'decline'].includes(decision)) throw new Error('Invalid decision.');
  if (decision === 'approve' && (!pickup.date || !pickup.time || !pickup.location?.trim())) {
    throw new Error('Please enter the pickup date, time, and location.');
  }
  const requestRef = doc(db, COLLECTIONS.requests, requestId);
  // The first read identifies the listing; the transaction verifies it again.
  const initial = await runTransaction(db, async tx => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error('Request not found.');
    return snap.data();
  });
  const listingRef = doc(db, COLLECTIONS.listings, initial.listingId);
  const pendingSnap = await getDocs(query(collection(db, COLLECTIONS.requests),
    where('listingId', '==', initial.listingId), where('status', '==', REQUEST_STATUS.pending)));
  const pendingRefs = pendingSnap.docs.map(snap => doc(db, COLLECTIONS.requests, snap.id));

  return runTransaction(db, async tx => {
    const listingSnap = await tx.get(listingRef);
    const requestSnap = await tx.get(requestRef);
    const pendingSnaps = [];
    for (const ref of pendingRefs) pendingSnaps.push(await tx.get(ref));
    if (!listingSnap.exists() || !requestSnap.exists()) throw new Error('Item or request not found.');
    const listing = listingSnap.data();
    const request = requestSnap.data();
    if (listing.ownerId !== ownerId || request.ownerId !== ownerId) throw new Error('Only the item owner can respond.');
    if (request.listingId !== initial.listingId) throw new Error('The request has changed. Refresh and try again.');
    if (request.status !== REQUEST_STATUS.pending) throw new Error('This request is no longer pending.');
    if (decision === 'approve' && listing.status !== LISTING_STATUS.active) {
      throw new Error('This item is no longer available.');
    }
    if (decision === 'decline') {
      tx.update(requestRef, { status: REQUEST_STATUS.declined, decidedAt: serverTimestamp() });
      return REQUEST_STATUS.declined;
    }
    // Reject if the pending request query became stale, rather than silently leaving
    // an outstanding request. Recheck the list in the caller after an error.
    for (const snap of pendingSnaps) {
      if (!snap.exists() || snap.data().status !== REQUEST_STATUS.pending) {
        throw new Error('Requests changed. Refresh and try again.');
      }
    }
    for (const snap of pendingSnaps) {
      tx.update(snap.ref, {
        status: snap.id === requestId ? REQUEST_STATUS.approved : REQUEST_STATUS.declined,
        decidedAt: serverTimestamp(),
        ...(snap.id === requestId ? {
          pickupDate: pickup.date, pickupTime: pickup.time, pickupLocation: pickup.location.trim(),
          stage: 'Approved',
        } : {}),
      });
    }
    tx.update(listingRef, { status: LISTING_STATUS.unavailable });
    return REQUEST_STATUS.approved;
  });
}
