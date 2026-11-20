import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
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
  const photoRef = ref(storage, `confirmationPhotos/${uid}/${requestId}/${kind}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  await uploadBytes(photoRef, photo, { contentType: photo.type });
  let photoUrl;
  try {
    photoUrl = await getDownloadURL(photoRef);
  } catch (cause) {
    await deleteObject(photoRef).catch(() => {});
    throw cause;
  }
  const requestRef = doc(db, COLLECTIONS.requests, requestId);
  const myRef = doc(db, COLLECTIONS.confirmationPhotos, confirmationId(requestId, kind, uid));
  const otherId = current.ownerId === uid ? current.requesterId : current.ownerId;
  const otherRef = doc(db, COLLECTIONS.confirmationPhotos, confirmationId(requestId, kind, otherId));
  const listingRef = doc(db, COLLECTIONS.listings, current.listingId);
  const finalReturn = kind === PHOTO_KINDS.return && uid === current.ownerId;
  const lenderUserRef = doc(db, COLLECTIONS.users, current.ownerId);
  const borrowerUserRef = doc(db, COLLECTIONS.users, current.requesterId);
  const lenderPointsRef = doc(db, COLLECTIONS.pointsRecords, `${requestId}_${current.ownerId}`);
  const borrowerPointsRef = doc(db, COLLECTIONS.pointsRecords, `${requestId}_${current.requesterId}`);
  try {
    await runTransaction(db, async tx => {
    const [requestSnap, mine, theirs, listingSnap, lenderUser, borrowerUser, lenderPoints, borrowerPoints] = await Promise.all([
      tx.get(requestRef), tx.get(myRef), tx.get(otherRef),
      ...(finalReturn ? [tx.get(listingRef), tx.get(lenderUserRef), tx.get(borrowerUserRef), tx.get(lenderPointsRef), tx.get(borrowerPointsRef)] : []),
    ]);
    if (!requestSnap.exists()) throw new Error('Request not found.');
    const request = requestSnap.data();
    if (!isParticipant(request, uid) || request.status !== REQUEST_STATUS.approved) throw new Error('Not allowed.');
    if ((request.stage || TRANSACTION_STAGE.approved) !== expectedStage) {
      throw new Error('This transaction has already moved to another stage.');
    }
    if (mine.exists()) throw new Error('You have already confirmed this exchange.');
    if (kind === PHOTO_KINDS.return && uid === request.ownerId &&
        (!listingSnap?.exists() || listingSnap.data().ownerId !== uid ||
         listingSnap.data().status !== 'On Loan' || listingSnap.data().approvedRequestId !== requestId)) {
      throw new Error('The listing is not ready to become available again.');
    }
    tx.set(myRef, { requestId, userId: uid, kind, photoUrl, createdAt: serverTimestamp() });
    if (kind === PHOTO_KINDS.pickup && theirs.exists()) {
      tx.update(requestRef, { stage: TRANSACTION_STAGE.pickup });
    }
    if (finalReturn) {
      // L7 / LS6 / P1 / P2: receipt, reactivation and both point awards are atomic.
      if (lenderPoints.exists() || borrowerPoints.exists()) throw new Error('Completion points have already been awarded.');
      tx.update(listingRef, { status: 'Active', approvedRequestId: null });
      for (const [userRef, userSnap, recordRef, userId, points] of [
        [lenderUserRef, lenderUser, lenderPointsRef, request.ownerId, 10],
        [borrowerUserRef, borrowerUser, borrowerPointsRef, request.requesterId, 5],
      ]) {
        const previous = userSnap.exists() ? Number(userSnap.data().totalPoints) || 0 : 0;
        tx.set(userRef, { totalPoints: previous + points, lastPointsRequestId: requestId }, { merge: true });
        tx.set(recordRef, { requestId, userId, points, reason: 'Completed borrowing transaction', createdAt: serverTimestamp() });
      }
    }
    if (kind === PHOTO_KINDS.return) {
      tx.update(requestRef, {
        stage: uid === request.requesterId ? TRANSACTION_STAGE.return : TRANSACTION_STAGE.received,
      });
    }
    });
  } catch (cause) {
    // A failed Firestore confirmation must not leave an unused upload behind.
    await deleteObject(photoRef).catch(() => {});
    throw cause;
  }
  return photoUrl;
}
