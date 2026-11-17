import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_TYPES, REQUEST_STATUS, TRANSACTION_STAGE } from './schema';

export const FEEDBACK_TAGS = {
  lender: ['On time', 'Polite', 'Gentle use', 'Quickly reply'],
  borrower: ['On time', 'Polite', 'Quickly reply'],
};

export function ratingId(requestId, uid) {
  return `${requestId}_${uid}`;
}

export async function getCompletion(requestId, uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.requests, requestId));
  if (!snap.exists()) throw new Error('Transaction not found.');
  const request = snap.data();
  if (request.listingType !== LISTING_TYPES.lend
    || request.status !== REQUEST_STATUS.approved
    || request.stage !== TRANSACTION_STAGE.received
    || ![request.ownerId, request.requesterId].includes(uid)) {
    throw new Error('This transaction is not ready for rating.');
  }
  const [rating, user] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.ratings, ratingId(requestId, uid))),
    getDoc(doc(db, COLLECTIONS.users, uid)),
  ]);
  return {
    request,
    rated: rating.exists(),
    totalPoints: user.exists() ? Number(user.data().totalPoints) || 0 : 0,
  };
}

export async function submitRating(requestId, uid, stars, tags) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('Please select a star rating.');
  const ratingRef = doc(db, COLLECTIONS.ratings, ratingId(requestId, uid));
  await runTransaction(db, async tx => {
    const requestRef = doc(db, COLLECTIONS.requests, requestId);
    const [requestSnap, ratingSnap] = await Promise.all([tx.get(requestRef), tx.get(ratingRef)]);
    if (!requestSnap.exists()) throw new Error('Transaction not found.');
    const request = requestSnap.data();
    if (request.listingType !== LISTING_TYPES.lend || request.status !== REQUEST_STATUS.approved
      || request.stage !== TRANSACTION_STAGE.received || ![request.ownerId, request.requesterId].includes(uid)) {
      throw new Error('You cannot rate this transaction yet.');
    }
    if (ratingSnap.exists()) throw new Error('You have already rated this transaction.');
    const role = request.ownerId === uid ? 'lender' : 'borrower';
    const validTags = FEEDBACK_TAGS[role];
    const selectedTags = [...new Set(tags)].filter(tag => validTags.includes(tag));
    tx.set(ratingRef, {
      requestId, raterId: uid,
      rateeId: role === 'lender' ? request.requesterId : request.ownerId,
      stars, tags: selectedTags, createdAt: serverTimestamp(),
    });
  });
}
