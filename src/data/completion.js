import { collection, doc, getDoc, getDocs, limit, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_TYPES, REQUEST_STATUS, TRANSACTION_STAGE } from './schema';

export const FEEDBACK_TAGS = {
  lender: ['On time', 'Polite', 'Gentle use', 'Quickly reply'],
  borrower: ['On time', 'Polite', 'Quickly reply'],
  giver: ['On time', 'Polite', 'Quickly reply'],
};

export function ratingId(requestId, uid) {
  return `${requestId}_${uid}`;
}

export async function getCompletion(requestId, uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.requests, requestId));
  if (!snap.exists()) throw new Error('Transaction not found.');
  const request = snap.data();
  // Lending finishes at Received. A giveaway finishes at Pickup (G4 → G5).
  const lendDone = request.listingType === LISTING_TYPES.lend && request.stage === TRANSACTION_STAGE.received;
  const giveDone = request.listingType === LISTING_TYPES.give && [TRANSACTION_STAGE.pickup, TRANSACTION_STAGE.rate].includes(request.stage);
  if (!(lendDone || giveDone)
    || request.status !== REQUEST_STATUS.approved
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
  if (!Array.isArray(tags)) throw new Error('Invalid feedback tags.');
  const ratingRef = doc(db, COLLECTIONS.ratings, ratingId(requestId, uid));
  await runTransaction(db, async tx => {
    const requestRef = doc(db, COLLECTIONS.requests, requestId);
    const [requestSnap, ratingSnap] = await Promise.all([tx.get(requestRef), tx.get(ratingRef)]);
    if (!requestSnap.exists()) throw new Error('Transaction not found.');
    const request = requestSnap.data();
    const lendAllowed = request.listingType === LISTING_TYPES.lend && request.stage === TRANSACTION_STAGE.received;
    const giveAllowed = request.listingType === LISTING_TYPES.give && request.ownerId === uid && request.stage === TRANSACTION_STAGE.pickup;
    if ((!lendAllowed && !giveAllowed) || request.status !== REQUEST_STATUS.approved || ![request.ownerId, request.requesterId].includes(uid)) {
      throw new Error('You cannot rate this transaction yet.');
    }
    if (ratingSnap.exists()) throw new Error('You have already rated this transaction.');
    const role = giveAllowed ? 'giver' : request.ownerId === uid ? 'lender' : 'borrower';
    const validTags = FEEDBACK_TAGS[role];
    if (tags.some(tag => !validTags.includes(tag))) throw new Error('Invalid feedback tags.');
    const selectedTags = [...new Set(tags)];
    const rateeId = role === 'borrower' ? request.ownerId : request.requesterId;
    const summaryRef = doc(db, 'ratingSummaries', rateeId);
    const summarySnap = await tx.get(summaryRef);
    if (!summarySnap.exists()) {
      const legacy = await getDocs(query(collection(db, COLLECTIONS.ratings), where('rateeId', '==', rateeId), limit(1)));
      if (!legacy.empty) throw new Error('Existing ratings need to be migrated before a new rating can be saved.');
    }
    const previous = summarySnap.exists() ? summarySnap.data() : { ratingTotal: 0, ratingCount: 0 };
    const ratingTotal = previous.ratingTotal + stars;
    const ratingCount = previous.ratingCount + 1;
    tx.set(summaryRef, {
      ratingTotal, ratingCount, overallRating: Math.round(ratingTotal / ratingCount),
      lastRatingId: ratingRef.id,
    });
    tx.set(ratingRef, {
      requestId, raterId: uid,
      // The owner (lender or giver) rates the requester; the borrower rates the owner.
      rateeId,
      stars, tags: selectedTags, createdAt: serverTimestamp(),
    });
    if (giveAllowed) tx.update(requestRef, { stage: TRANSACTION_STAGE.rate });
  });
}

