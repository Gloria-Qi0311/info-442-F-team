import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_STATUS } from './schema.js';

// Save a new listing (L1.12, S1.16, G1.13). New listings start as Active (LS1).
// photoUrl comes from uploadListingPhoto in photos.js (Issue #7).
export async function createListing(type, values, owner, photoUrl) {
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

  const ref = await addDoc(collection(db, COLLECTIONS.listings), listing);
  return ref.id;
}

export async function getListing(listingId) {
  const snap = await getDoc(doc(db, COLLECTIONS.listings, listingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
    if (!isPastAvailability(listing)) {
      listings.push(listing);
    }
  });
  return listings;
}
