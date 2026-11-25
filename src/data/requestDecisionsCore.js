import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { requestStatus, requireRequestSchema } from './requestStatus.js';
import { isPastAvailability } from './availability.js';
import { COLLECTIONS, LISTING_STATUS, LISTING_TYPES, REQUEST_STATUS } from './schema.js';

// Approve or decline a request. Only the listing owner may make this decision.
// The epoch and selected decision commit together; every rival becomes Declined.
export async function decideItemRequestInDatabase(db, requestId, ownerId, decision, pickup = {}) {
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
  return runTransaction(db, async tx => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists()) throw new Error('Request not found.');
    const listingRef = doc(db, COLLECTIONS.listings, requestSnap.data().listingId);
    const listingSnap = await tx.get(listingRef);
    if (!listingSnap.exists()) throw new Error('Item not found.');
    const listing = listingSnap.data();
    const request = requestSnap.data();
    if (listing.ownerId !== ownerId || request.ownerId !== ownerId) throw new Error('Only the item owner can respond.');
    requireRequestSchema(listing);
    const status = requestStatus(request, listing);
    if (status === REQUEST_STATUS.cancelled) throw new Error('This request was canceled.');
    if (status !== REQUEST_STATUS.pending) throw new Error('This request is no longer pending.');
    if (decision === 'approve' && (listing.status !== LISTING_STATUS.active || isPastAvailability(listing))) {
      throw new Error('This item is no longer available.');
    }
    if (decision === 'decline') {
      tx.update(requestRef, { status: REQUEST_STATUS.declined, decidedAt: serverTimestamp() });
      return REQUEST_STATUS.declined;
    }
    tx.update(requestRef, {
      status: REQUEST_STATUS.approved, decidedAt: serverTimestamp(),
      pickupDate: pickup.date, pickupTime: pickup.time,
      pickupLocation: pickup.location.trim(), stage: 'Approved',
    });
    const approvedListingStatus = {
      [LISTING_TYPES.lend]: LISTING_STATUS.onLoan,
      [LISTING_TYPES.sell]: LISTING_STATUS.sold,
      [LISTING_TYPES.give]: LISTING_STATUS.givenAway,
    }[listing.type];
    if (!approvedListingStatus || request.listingType !== listing.type) {
      throw new Error('The request type does not match this listing.');
    }
    tx.update(listingRef, { status: approvedListingStatus, approvedRequestId: requestId, approvalEpoch: listing.approvalEpoch + 1 });
    return REQUEST_STATUS.approved;
  });
}

