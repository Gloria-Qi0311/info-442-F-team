import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
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
