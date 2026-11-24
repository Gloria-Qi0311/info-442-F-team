import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadListingPhoto } from './photos';
import { COLLECTIONS, LISTING_TYPES, PHOTO_KINDS, REQUEST_STATUS, TRANSACTION_STAGE } from './schema';

export const STAGES = [
  TRANSACTION_STAGE.approved,
  TRANSACTION_STAGE.pickup,
  TRANSACTION_STAGE.return,
  TRANSACTION_STAGE.received,
];

export function confirmationId(requestId, kind, uid) {
  return `${requestId}_${kind}_${uid}`;
}

export function isParticipant(request, uid) {
  return request && (request.ownerId === uid || request.requesterId === uid);
}

export async function getTransaction(requestId, uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.requests, requestId));
  if (!snap.exists()) throw new Error('Request not found.');
  const request = { id: snap.id, ...snap.data() };
  if (!isParticipant(request, uid) || request.status !== REQUEST_STATUS.approved) {
    throw new Error('This transaction is not available to your account.');
  }
  return request;
}

export async function confirmExchange(requestId, uid, kind, photo) {
  if (![PHOTO_KINDS.pickup, PHOTO_KINDS.return].includes(kind)) {
    throw new Error('Unknown confirmation type.');
  }
  if (!photo) throw new Error('Please upload a photo.');
  if (!photo.type.startsWith('image/') || photo.size > 10 * 1024 * 1024) {
    throw new Error('Please select an image smaller than 10 MB.');
  }
  const current = await getTransaction(requestId, uid);
  if (current.listingType !== LISTING_TYPES.lend) throw new Error('Only lending transactions use this confirmation.');
  const expectedStage = kind === PHOTO_KINDS.pickup ? TRANSACTION_STAGE.approved
    : uid === current.ownerId ? TRANSACTION_STAGE.return : TRANSACTION_STAGE.pickup;
  if ((current.stage || TRANSACTION_STAGE.approved) !== expectedStage) {
    throw new Error('This confirmation is not available at the current stage.');
  }
  // Store a compressed confirmation image in Firestore, as listing photos do.
  // This works on Firebase Spark without a Storage billing requirement.
  let photoUrl;
  try {
    photoUrl = await uploadListingPhoto(photo);
  } catch {
    throw new Error('Photo could not be processed. Please try another image.');
  }
  const requestRef = doc(db, COLLECTIONS.requests, requestId);
  const myRef = doc(db, COLLECTIONS.confirmationPhotos, confirmationId(requestId, kind, uid));
  const otherId = current.ownerId === uid ? current.requesterId : current.ownerId;
  const otherRef = doc(db, COLLECTIONS.confirmationPhotos, confirmationId(requestId, kind, otherId));
  const listingRef = doc(db, COLLECTIONS.listings, current.listingId);
  try {
    await runTransaction(db, async tx => {
      const isReceivingReturn = kind === PHOTO_KINDS.return && uid === current.ownerId;
      const reads = [tx.get(requestRef), tx.get(myRef), tx.get(otherRef)];
      if (isReceivingReturn) {
        reads.push(
          tx.get(listingRef),
          tx.get(doc(db, COLLECTIONS.users, current.ownerId)),
          tx.get(doc(db, COLLECTIONS.users, current.requesterId)),
        );
      }
      const [requestSnap, mine, theirs, listingSnap, ownerUserSnap, borrowerUserSnap] = await Promise.all(reads);
      if (!requestSnap.exists()) throw new Error('Request not found.');
      const request = requestSnap.data();
      if (!isParticipant(request, uid) || request.status !== REQUEST_STATUS.approved) throw new Error('Not allowed.');
      if ((request.stage || TRANSACTION_STAGE.approved) !== expectedStage) {
        throw new Error('This transaction has already moved to another stage.');
      }
      if (mine.exists()) throw new Error('You have already confirmed this exchange.');
      if (isReceivingReturn &&
          (!listingSnap?.exists() || listingSnap.data().ownerId !== uid ||
           listingSnap.data().status !== 'On Loan' || listingSnap.data().approvedRequestId !== requestId)) {
        throw new Error('The listing is not ready to become available again.');
      }

      tx.set(myRef, { requestId, userId: uid, kind, photoUrl, createdAt: serverTimestamp() });
      if (kind === PHOTO_KINDS.pickup && theirs.exists()) {
        tx.update(requestRef, { stage: TRANSACTION_STAGE.pickup });
      }
      if (kind === PHOTO_KINDS.return && uid === request.requesterId) {
        tx.update(requestRef, { stage: TRANSACTION_STAGE.return });
      }
      if (isReceivingReturn) {
        // LS6 + P1/P2: receiving, reactivating, and awarding both users' points
        // are one atomic Firestore transaction. This works on the Spark plan.
        const ownerPoints = Number(ownerUserSnap?.data()?.totalPoints) || 0;
        const borrowerPoints = Number(borrowerUserSnap?.data()?.totalPoints) || 0;
        const ownerUserRef = doc(db, COLLECTIONS.users, request.ownerId);
        const borrowerUserRef = doc(db, COLLECTIONS.users, request.requesterId);
        const ownerPointsRef = doc(db, COLLECTIONS.pointsRecords, `${requestId}_${request.ownerId}`);
        const borrowerPointsRef = doc(db, COLLECTIONS.pointsRecords, `${requestId}_${request.requesterId}`);

        tx.update(requestRef, { stage: TRANSACTION_STAGE.received });
        tx.update(listingRef, { status: 'Active', approvedRequestId: null });
        const ownerUpdate = { totalPoints: ownerPoints + 10, lastPointsRequestId: requestId };
        const borrowerUpdate = { totalPoints: borrowerPoints + 5, lastPointsRequestId: requestId };
        if (ownerUserSnap.exists()) tx.update(ownerUserRef, ownerUpdate);
        else tx.set(ownerUserRef, ownerUpdate);
        if (borrowerUserSnap.exists()) tx.update(borrowerUserRef, borrowerUpdate);
        else tx.set(borrowerUserRef, borrowerUpdate);
        tx.set(ownerPointsRef, {
          requestId, userId: request.ownerId, points: 10,
          reason: 'Completed borrowing transaction', createdAt: serverTimestamp(),
        });
        tx.set(borrowerPointsRef, {
          requestId, userId: request.requesterId, points: 5,
          reason: 'Completed borrowing transaction', createdAt: serverTimestamp(),
        });
      }
    });
  } catch (cause) {
    throw cause;
  }
  return photoUrl;
}

// S6.7–S6.9, G4.8–G4.11: for selling, the buyer marks the item as picked up.
// For giving, the giver marks it. If anything fails, the stage stays the same.
export async function confirmSellGivePickup(requestId, uid) {
  const requestRef = doc(db, COLLECTIONS.requests, requestId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error('Request not found.');
    const request = snap.data();
    if (request.status !== REQUEST_STATUS.approved) throw new Error('This transaction is not approved.');
    const giverRef = doc(db, COLLECTIONS.users, request.ownerId);
    const recordRef = doc(db, COLLECTIONS.pointsRecords, `${requestId}_${request.ownerId}`);
    const giverSnap = request.listingType === LISTING_TYPES.give ? await tx.get(giverRef) : null;
    const recordSnap = request.listingType === LISTING_TYPES.give ? await tx.get(recordRef) : null;
    let confirmerId = null;
    if (request.listingType === LISTING_TYPES.sell) confirmerId = request.requesterId;
    if (request.listingType === LISTING_TYPES.give) confirmerId = request.ownerId;
    if (confirmerId !== uid) throw new Error('Only the buyer or the giver can confirm this pickup.');
    if ((request.stage || TRANSACTION_STAGE.approved) !== TRANSACTION_STAGE.approved) {
      throw new Error('This item has already been picked up.');
    }
    if (request.listingType === LISTING_TYPES.give) {
      if (recordSnap?.exists()) throw new Error('Giveaway points were already awarded.');
      const giverUpdate = { totalPoints: (Number(giverSnap?.data()?.totalPoints) || 0) + 15, lastPointsRequestId: requestId };
      if (giverSnap.exists()) tx.update(giverRef, giverUpdate);
      else tx.set(giverRef, giverUpdate);
      tx.set(recordRef, { requestId, userId: request.ownerId, points: 15,
        reason: 'Completed giveaway transaction', createdAt: serverTimestamp() });
    }
    tx.update(requestRef, { stage: TRANSACTION_STAGE.pickup });
  });
}
