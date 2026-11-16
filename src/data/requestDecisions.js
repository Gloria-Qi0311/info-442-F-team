import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_STATUS, REQUEST_STATUS } from './schema';

// Approve or decline a request. Only the listing owner may make this decision.
// All known pending requests are updated in the same transaction as the listing.
export async function decideItemRequest(requestId, ownerId, decision, pickup = {}) {
  if (!['approve', 'decline'].includes(decision)) throw new Error('Invalid decision.');
  if (decision === 'approve') {
    if (!pickup.date) throw new Error('Please enter a pickup date.');
    if (!pickup.time) throw new Error('Please enter a pickup time.');
    if (!pickup.location?.trim()) throw new Error('Please enter a pickup location.');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const [year, month, day] = pickup.date.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!datePattern.test(pickup.date) || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
      throw new Error('Please enter a valid pickup date.');
    }
    if (pickup.date < today) throw new Error('Pickup date must be today or later.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(pickup.time)) {
      throw new Error('Please enter a valid pickup time.');
    }
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
    where('listingId', '==', initial.listingId), where('ownerId', '==', ownerId), where('status', '==', REQUEST_STATUS.pending)));
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
    if (request.status === REQUEST_STATUS.cancelled) throw new Error('This request was canceled.');
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
    if (!pendingRefs.some(ref => ref.id === requestId)) {
      throw new Error('Request list changed. Refresh and try again.');
    }
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
    tx.update(listingRef, { status: LISTING_STATUS.unavailable, approvedRequestId: requestId });
    return REQUEST_STATUS.approved;
  });
}

/**
 * Repair pending requests left by a submission racing an approval.
 * Safe to call repeatedly: each update verifies that the listing has
 * an approved winner and the request is still Pending.
 * This is best-effort client reconciliation, not a server-side trigger.
 */
export async function reconcilePendingRequests(listingId, ownerId) {
  const listingRef = doc(db, COLLECTIONS.listings, listingId);
  const listingSnap = await runTransaction(db, tx => tx.get(listingRef));
  if (!listingSnap.exists()) return 0;
  const listing = listingSnap.data();
  if (listing.ownerId !== ownerId || listing.status !== LISTING_STATUS.unavailable || !listing.approvedRequestId) {
    return 0;
  }
  const pending = await getDocs(query(collection(db, COLLECTIONS.requests),
    where('listingId', '==', listingId), where('ownerId', '==', ownerId),
    where('status', '==', REQUEST_STATUS.pending)));
  let declined = 0;
  for (const candidate of pending.docs) {
    if (candidate.id === listing.approvedRequestId) continue;
    const changed = await runTransaction(db, async tx => {
      const currentListing = await tx.get(listingRef);
      const currentRequest = await tx.get(candidate.ref);
      if (!currentListing.exists() || !currentRequest.exists()) return false;
      const item = currentListing.data();
      const request = currentRequest.data();
      if (item.ownerId !== ownerId || item.status !== LISTING_STATUS.unavailable ||
          !item.approvedRequestId || candidate.id === item.approvedRequestId ||
          request.ownerId !== ownerId || request.listingId !== listingId ||
          request.status !== REQUEST_STATUS.pending) return false;
      tx.update(candidate.ref, { status: REQUEST_STATUS.declined, decidedAt: serverTimestamp() });
      return true;
    });
    if (changed) declined += 1;
  }
  return declined;
}
