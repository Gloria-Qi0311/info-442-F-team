import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_STATUS } from './schema.js';

// Pick the ID for a new listing before saving, so retries reuse it (NF9).
export function newListingId() {
  return doc(collection(db, COLLECTIONS.listings)).id;
}

// Save a new listing (L1.12, S1.16, G1.13). New listings start as Active (LS1).
// photoUrl is a compressed JPEG data URL from uploadListingPhoto in photos.js (Issue #7).
// NF9: a transaction fails while offline instead of being queued, and the fixed
// listingId means a retry after a lost response cannot create a duplicate.
// Once save.aborted is set, later attempts stop before writing; save.committing
// tells the caller a write may already be on its way to the server.
export async function createListing(type, values, owner, photoUrl, listingId, save = {}) {
  const listing = {
    ownerId: owner.uid,
    ownerName: owner.displayName || 'UW Student',
    type,
    title: values.title.trim(),
    category: values.category,
    condition: values.condition,
    pickupAreaId: values.pickupAreaId,
    availableFrom: values.availableFrom,
    availableUntil: values.availableUntil,
    timeSlot: values.timeSlot,
    photoUrl,
    status: LISTING_STATUS.active,
    createdAt: serverTimestamp(),
  };
  if (type === 'sell') {
    listing.price = Number(values.price);
  }

  const ref = doc(db, COLLECTIONS.listings, listingId);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      return;
    }
    if (save.aborted) {
      throw new Error('Saving was cancelled');
    }
    save.committing = true;
    transaction.set(ref, listing);
  });
  return listingId;
}

export async function getListing(listingId) {
  const snap = await getDoc(doc(db, COLLECTIONS.listings, listingId));
  if (!snap.exists()) return null;
  const listing = { id: snap.id, ...snap.data() };
  if (listing.status === LISTING_STATUS.active && isPastAvailability(listing)) {
    markInactive(listing.id);
    listing.status = LISTING_STATUS.inactive;
  }
  return listing;
}

// LS9: an Active listing whose availability window has ended becomes Inactive,
// whoever loads it first.
function markInactive(listingId) {
  updateDoc(doc(db, COLLECTIONS.listings, listingId), {
    status: LISTING_STATUS.inactive,
  }).catch((error) => console.error('Could not mark listing inactive:', error));
}

// Returns true if the listing's availability window has already ended.
export function isPastAvailability(listing) {
  if (!listing.availableUntil) {
    return false;
  }
  // availableUntil is saved as "YYYY-MM-DD"; it stays available through that day.
  const end = new Date(listing.availableUntil + 'T23:59:59');
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

// Loads the listings that should appear on the map (F2.1–F2.3, LS2–LS3):
// only Active listings whose availability window has not ended.
export async function getMapListings() {
  const activeQuery = query(
    collection(db, COLLECTIONS.listings),
    where('status', '==', LISTING_STATUS.active),
  );
  const snap = await getDocs(activeQuery);
  const listings = [];
  snap.forEach((docSnap) => {
    const listing = { id: docSnap.id, ...docSnap.data() };
    if (isPastAvailability(listing)) {
      markInactive(listing.id);
    } else {
      listings.push(listing);
    }
  });
  return listings;
}

// Loads each owner's total points so search results can be ordered (P5).
// Owners without a user document count as 0 points.
export async function getOwnerPoints(ownerIds) {
  const points = {};
  await Promise.all(
    [...new Set(ownerIds)].map(async (uid) => {
      const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
      points[uid] = snap.exists() ? Number(snap.data().totalPoints) || 0 : 0;
    }),
  );
  return points;
}
