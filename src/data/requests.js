import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { isPastAvailability } from './listings.js';
import { COLLECTIONS, LISTING_STATUS, LISTING_TYPES, REQUEST_STATUS } from './schema.js';

// Issue #14: purchase requests (S5) and giveaway requests (G6).
//
// Each user can have one request per listing, so the request ID is built from
// the listing ID and the requester's ID. Sending twice (or retrying after a lost
// response) reuses the same document instead of creating a duplicate.
export function requestIdFor(listingId, requesterId) {
  return `${listingId}_${requesterId}`;
}

// Loads the current user's request for one listing, or null if there is none.
export async function getMyRequest(listingId, requesterId) {
  const snap = await getDoc(doc(db, COLLECTIONS.requests, requestIdFor(listingId, requesterId)));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// S5 / G6: "I want it". Creates a Pending request for a Sell or Give listing.
// Throws an Error with a message that can be shown to the user if the request
// can't be sent.
export async function sendItemRequest(listingId, requester) {
  const listingRef = doc(db, COLLECTIONS.listings, listingId);
  const requestRef = doc(db, COLLECTIONS.requests, requestIdFor(listingId, requester.uid));

  return runTransaction(db, async (transaction) => {
    const listingSnap = await transaction.get(listingRef);
    if (!listingSnap.exists()) {
      throw new Error('This item could not be found.');
    }
    const listing = listingSnap.data();

    if (listing.type !== LISTING_TYPES.sell && listing.type !== LISTING_TYPES.give) {
      throw new Error('Requests for this type of item are not available here.');
    }
    if (listing.ownerId === requester.uid) {
      throw new Error('You cannot request your own item.');
    }
    if (listing.status !== LISTING_STATUS.active || isPastAvailability(listing)) {
      throw new Error('This item is no longer available.');
    }

    const existingSnap = await transaction.get(requestRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data();
      if (existing.status === REQUEST_STATUS.pending || existing.status === REQUEST_STATUS.approved) {
        // Already sent: nothing new to save.
        return { id: existingSnap.id, ...existing };
      }
      if (existing.status === REQUEST_STATUS.declined) {
        throw new Error('The owner has declined your request for this item.');
      }
      // A canceled request can be sent again below.
    }

    const request = {
      listingId,
      listingType: listing.type,
      listingTitle: listing.title || listing.itemName || '',
      ownerId: listing.ownerId,
      requesterId: requester.uid,
      requesterName: requester.displayName || 'UW Student',
      status: REQUEST_STATUS.pending,
      stage: null,
      viewedByOwner: false,
      createdAt: serverTimestamp(),
    };
    transaction.set(requestRef, request);
    return { id: requestRef.id, ...request };
  });
}

// Lets the requester cancel a request while it is still Pending.
export async function cancelItemRequest(requestId, requesterId) {
  const requestRef = doc(db, COLLECTIONS.requests, requestId);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (!snap.exists()) {
      throw new Error('This request could not be found.');
    }
    const request = snap.data();
    if (request.requesterId !== requesterId) {
      throw new Error('You can only cancel your own requests.');
    }
    if (request.status !== REQUEST_STATUS.pending) {
      throw new Error(`This request is already ${request.status.toLowerCase()} and can no longer be canceled.`);
    }
    transaction.update(requestRef, {
      status: REQUEST_STATUS.cancelled,
      cancelledAt: serverTimestamp(),
    });
    return { id: snap.id, ...request, status: REQUEST_STATUS.cancelled };
  });
}

// S3 / G3: all requests the owner has received for one listing, newest first.
export async function getRequestsForListing(listingId, ownerId) {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.requests),
    where('ownerId', '==', ownerId),
    where('listingId', '==', listingId),
  ));
  const requests = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  requests.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  return requests;
}

// Marks the owner's unviewed requests as viewed once they open the request list,
// so the "new requests" badge on Manage can count only unviewed ones.
export async function markRequestsViewed(requests) {
  const unviewed = requests.filter((request) => request.viewedByOwner === false);
  await Promise.allSettled(
    unviewed.map((request) => updateDoc(doc(db, COLLECTIONS.requests, request.id), {
      viewedByOwner: true,
    })),
  );
}

// Issue #17 (H8–H10): every request the user has sent, newest first.
export async function getMySentRequests(requesterId) {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.requests),
    where('requesterId', '==', requesterId),
  ));
  const requests = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  requests.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  return requests;
}

// Issue #17 (H4): live count of Pending requests on the user's listings that
// the user has not viewed yet. Returns the unsubscribe function.
export function watchUnviewedRequestCount(ownerId, onCount) {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.requests),
      where('ownerId', '==', ownerId),
      where('status', '==', REQUEST_STATUS.pending),
      where('viewedByOwner', '==', false),
    ),
    (snap) => onCount(snap.size),
    (cause) => {
      console.error('Could not load unviewed requests:', cause);
      onCount(0);
    },
  );
}

function timeOf(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  return 0;
}
