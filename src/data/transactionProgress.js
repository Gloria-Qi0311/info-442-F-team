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
  try {
    await runTransaction(db, async tx => {
    const [requestSnap, mine, theirs, listingSnap] = await Promise.all([
      tx.get(requestRef), tx.get(myRef), tx.get(otherRef),
      ...(kind === PHOTO_KINDS.return && uid === current.ownerId ? [tx.get(listingRef)] : []),
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
    if (kind === PHOTO_KINDS.return && uid === request.ownerId) {
      // LS6: the return and listing reactivation must succeed or fail together.
      tx.update(listingRef, { status: 'Active', approvedRequestId: null });
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
