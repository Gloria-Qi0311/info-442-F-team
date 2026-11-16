import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_STATUS, LISTING_TYPES, REQUEST_STATUS } from './schema';
import { requestIdFor } from './requests';
import { isPastAvailability } from './listings';

export async function sendBorrowRequest(listingId, user, values) {
  if (!values.startDate) throw new Error('Please enter a start date.');
  if (!values.endDate) throw new Error('Please enter a return date.');
  if (!values.pickupPreference?.trim()) throw new Error('Please enter a pickup preference.');
  if (!values.purpose?.trim()) throw new Error('Please enter a purpose of use.');
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(values.startDate) || !datePattern.test(values.endDate)) throw new Error('Please enter valid dates.');
  const isCalendarDate = value => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  if (!isCalendarDate(values.startDate) || !isCalendarDate(values.endDate)) throw new Error('Please enter valid calendar dates.');
  if (values.endDate < values.startDate) throw new Error('Return date cannot be before start date.');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (values.startDate < today) throw new Error('Start date must be today or later.');
  const listingRef = doc(db, COLLECTIONS.listings, listingId);
  const requestRef = doc(db, COLLECTIONS.requests, requestIdFor(listingId, user.uid));
  return runTransaction(db, async tx => {
    const listingSnap = await tx.get(listingRef);
    const existing = await tx.get(requestRef);
    if (!listingSnap.exists()) throw new Error('Item not found.');
    const listing = listingSnap.data();
    if (listing.type !== LISTING_TYPES.lend) throw new Error('This item cannot be borrowed.');
    if (listing.ownerId === user.uid) throw new Error('You cannot borrow your own item.');
    if (listing.status !== LISTING_STATUS.active || isPastAvailability(listing)) throw new Error('Item is unavailable.');
    if ((listing.availableFrom && values.startDate < listing.availableFrom) || (listing.availableUntil && values.endDate > listing.availableUntil)) {
      throw new Error('Choose dates within the item availability period.');
    }
    if (existing.exists() && [REQUEST_STATUS.pending, REQUEST_STATUS.approved].includes(existing.data().status)) {
      throw new Error('You already have a request for this item.');
    }
    if (existing.exists() && existing.data().status === REQUEST_STATUS.declined) {
      throw new Error('Your previous request was declined.');
    }
    const requestData = {
      listingId, listingType: LISTING_TYPES.lend,
      listingTitle: listing.title, ownerId: listing.ownerId,
      requesterId: user.uid, requesterName: user.displayName || 'UW Student',
      status: REQUEST_STATUS.pending, stage: null, viewedByOwner: false,
      startDate: values.startDate, endDate: values.endDate,
      pickupPreference: values.pickupPreference.trim(), purpose: values.purpose.trim(),
      createdAt: serverTimestamp(),
    };
    if (existing.exists()) {
      tx.update(requestRef, requestData);
    } else {
      tx.set(requestRef, requestData);
    }
    return requestRef.id;
  });
}

export async function getBorrowRequest(listingId, uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.requests, requestIdFor(listingId, uid)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
