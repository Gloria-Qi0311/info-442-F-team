import { decideItemRequestInDatabase } from '../src/data/requestDecisionsCore.js';
import { migrateRequestEpochs } from '../scripts/lib/migrate-request-epochs.js';
import { requestStatus } from '../src/data/requestStatus.js';
import { initializeApp as initializeAdminApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { expireListings } from '../scripts/lib/expire-listings.js';
import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch, deleteField, runTransaction, deleteDoc, getDocs, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { rejects, equal, deepEqual } from 'node:assert/strict';
import { saveWithTimeout } from '../src/data/saveWithTimeout.js';

const projectId = 'demo-husky-share';
let testEnv;

const listing = {
  ownerId: 'owner-1',
  type: 'lend',
  status: 'Active', requestSchemaVersion: 2, approvalEpoch: 0,
  title: 'Test item',
  availableFrom: '2026-11-01',
  availableUntil: '2026-12-31',
};

// NF9 / G4.11: stamp a server-side save window, then consume it in the batch.
async function startWindow(db, uid) {
  await setDoc(doc(db, 'saveAttempts/' + uid), { startedAt: serverTimestamp() });
}
function inTime(batch, db, uid, windowMs = 15000) {
  batch.update(doc(db, 'saveAttempts/' + uid), { windowMs, consumedAt: serverTimestamp() });
  return batch;
}
async function timedSet(db, uid, path, data) {
  await startWindow(db, uid);
  const batch = writeBatch(db);
  batch.set(doc(db, path), data);
  return inTime(batch, db, uid).commit();
}

function uwContext(uid) {
  return testEnv.authenticatedContext(uid, {
    email: uid + '@uw.edu',
    email_verified: true,
  }).firestore();
}

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'listings/item-1'), listing);
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('verified UW requester can create their own pending request', async () => {
  const db = uwContext('requester-1');
  const batch = writeBatch(db);
  batch.update(doc(db, 'listings/item-1'), { requestVersion: 1 });
  batch.set(doc(db, 'requests/item-1_requester-1'), {
    listingId: 'item-1',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'requester-1',
    requestEpoch: 0,
    startDate: '2026-12-20',
    endDate: '2026-12-22',
    pickupPreference: 'After class',
    purpose: 'Course project',
    listingTitle: 'Test item',
  });
  await assertSucceeds(batch.commit());
});

test('a requester cannot increment the listing request version without a matching Pending request', async () => {
  const requester = uwContext('requester-1');
  await assertFails(updateDoc(doc(requester, 'listings/item-1'), {
    requestVersion: 1,
  }));
});

test('unverified or non-UW users cannot create requests', async () => {
  const unverified = testEnv.authenticatedContext('bad-user', {
    email: 'bad-user@uw.edu',
    email_verified: false,
  }).firestore();
  await assertFails(setDoc(doc(unverified, 'requests/item-1_bad-user'), {
    listingId: 'item-1',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'bad-user',
    requestEpoch: 0,
  }));

  const nonUw = testEnv.authenticatedContext('external-user', {
    email: 'external@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(setDoc(doc(nonUw, 'requests/item-1_external-user'), {
    listingId: 'item-1',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'external-user',
    requestEpoch: 0,
  }));
});

test('a requester cannot read or change another requester\'s request', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      requestEpoch: 0,
    });
  });
  const other = uwContext('requester-2');
  await assertFails(getDoc(doc(other, 'requests/item-1_requester-1')));
  await assertFails(updateDoc(doc(other, 'requests/item-1_requester-1'), {
    status: 'Canceled',
  }));
});

test('only the listing owner can atomically approve a borrow request and mark the listing On Loan', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      requestEpoch: 0,
    });
  });

  const outsider = uwContext('outsider');
  await assertFails(updateDoc(doc(outsider, 'requests/item-1_requester-1'), {
    status: 'Approved',
  }));

  const owner = uwContext('owner-1');
  const batch = writeBatch(owner);
  batch.update(doc(owner, 'requests/item-1_requester-1'), {
    status: 'Approved',
    pickupDate: '2026-11-20',
    pickupTime: '15:00',
    pickupLocation: 'Suzzallo Library',
  });
  batch.update(doc(owner, 'listings/item-1'), {
    status: 'On Loan', approvalEpoch: 1,
    approvedRequestId: 'item-1_requester-1',
  });
  await assertSucceeds(batch.commit());
});


test('a requester can cancel their own pending request, but cannot cancel an approved request', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/item-1_requester-1'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      requestEpoch: 0,
    });
    await setDoc(doc(db, 'requests/item-1_requester-2'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-2',
      status: 'Approved',
    });
  });

  const requester = uwContext('requester-1');
  await assertSucceeds(updateDoc(doc(requester, 'requests/item-1_requester-1'), {
    status: 'Canceled',
    cancelledAt: new Date(),
  }));

  const approvedRequester = uwContext('requester-2');
  await assertFails(updateDoc(doc(approvedRequester, 'requests/item-1_requester-2'), {
    status: 'Canceled',
    cancelledAt: new Date(),
  }));
});

test('only the listing owner can decline a pending request', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      requestEpoch: 0,
    });
  });

  const requester = uwContext('requester-1');
  await assertFails(updateDoc(doc(requester, 'requests/item-1_requester-1'), {
    status: 'Declined',
    decidedAt: new Date(),
  }));

  const owner = uwContext('owner-1');
  await assertSucceeds(updateDoc(doc(owner, 'requests/item-1_requester-1'), {
    status: 'Declined',
    decidedAt: new Date(),
  }));
});

test('requesters cannot request their own listing or a listing that is no longer active', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'listings/item-2'), {
      ...listing,
      status: 'Unavailable',
    });
  });

  const owner = uwContext('owner-1');
  await assertFails(setDoc(doc(owner, 'requests/item-1_owner-1'), {
    listingId: 'item-1',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'owner-1',
    requestEpoch: 0,
  }));

  const requester = uwContext('requester-1');
  await assertFails(setDoc(doc(requester, 'requests/item-2_requester-1'), {
    listingId: 'item-2',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'requester-1',
    requestEpoch: 0,
  }));
});

test('approving one request declines every other pending request in the same atomic update', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/item-1_requester-1'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      requestEpoch: 0,
    });
    await setDoc(doc(db, 'requests/item-1_requester-2'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-2',
      requestEpoch: 0,
    });
  });

  const owner = uwContext('owner-1');
  const batch = writeBatch(owner);
  batch.update(doc(owner, 'requests/item-1_requester-1'), {
    status: 'Approved',
    pickupDate: '2026-11-20',
    pickupTime: '15:00',
    pickupLocation: 'Suzzallo Library',
  });
  batch.update(doc(owner, 'requests/item-1_requester-2'), {
    status: 'Declined',
    decidedAt: new Date(),
  });
  batch.update(doc(owner, 'listings/item-1'), {
    status: 'On Loan', approvalEpoch: 1,
    approvedRequestId: 'item-1_requester-1',
  });
  await assertSucceeds(batch.commit());

  const requesterOne = uwContext('requester-1');
  const requesterTwo = uwContext('requester-2');
  const approved = await getDoc(doc(requesterOne, 'requests/item-1_requester-1'));
  const declined = await getDoc(doc(requesterTwo, 'requests/item-1_requester-2'));
  if (approved.data().status !== 'Approved' || declined.data().status !== 'Declined') {
    throw new Error('Request statuses did not match the approval decision.');
  }
});


test('purchase and giveaway approvals set their required listing statuses', async () => {
  for (const [type, expectedStatus] of [['sell', 'Sold'], ['give', 'Given Away']]) {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'listings/item-1'), { ...listing, type, status: 'Active' });
      await setDoc(doc(db, 'requests/item-1_requester-1'), {
        listingId: 'item-1',
        listingType: type,
        ownerId: 'owner-1',
        requesterId: 'requester-1',
        requestEpoch: 0,
      });
    });

    const owner = uwContext('owner-1');
    const batch = writeBatch(owner);
    batch.update(doc(owner, 'requests/item-1_requester-1'), {
      status: 'Approved',
      pickupDate: '2026-11-20',
      pickupTime: '15:00',
      pickupLocation: 'Suzzallo Library',
    });
    batch.update(doc(owner, 'listings/item-1'), {
      status: expectedStatus, approvalEpoch: 1,
      approvedRequestId: 'item-1_requester-1',
    });
    await assertSucceeds(batch.commit());
  }
});

test('lending pickup needs both photos and return advances in the correct order', async () => {
  const requestId = 'item-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Approved',
    });
    await setDoc(doc(db, 'users/owner-1'), { totalPoints: 0 });
    await setDoc(doc(db, 'users/requester-1'), { totalPoints: 0 });
  });
  const borrower = uwContext('requester-1');
  const owner = uwContext('owner-1');
  const photo = (uid, kind) => ({
    requestId, userId: uid, kind,
    photoUrl: 'https://example.com/photo.jpg',
    createdAt: new Date(),
  });

  await assertFails(updateDoc(doc(borrower, 'requests/' + requestId), { stage: 'Pickup' }));
  await assertFails(setDoc(doc(borrower, 'confirmationPhotos/' + requestId + '_pickup_requester-1'), photo('requester-1', 'pickup')));
  await assertSucceeds(timedSet(borrower, 'requester-1', 'confirmationPhotos/' + requestId + '_pickup_requester-1', photo('requester-1', 'pickup')));
  await assertFails(updateDoc(doc(borrower, 'requests/' + requestId), { stage: 'Pickup' }));

  await startWindow(owner, 'owner-1');
  const pickup = inTime(writeBatch(owner), owner, 'owner-1');
  pickup.set(doc(owner, 'confirmationPhotos/' + requestId + '_pickup_owner-1'), photo('owner-1', 'pickup'));
  pickup.update(doc(owner, 'requests/' + requestId), { stage: 'Pickup' });
  await assertSucceeds(pickup.commit());

  await assertFails(updateDoc(doc(owner, 'requests/' + requestId), { stage: 'Received' }));
  await startWindow(borrower, 'requester-1');
  const returning = inTime(writeBatch(borrower), borrower, 'requester-1');
  returning.set(doc(borrower, 'confirmationPhotos/' + requestId + '_return_requester-1'), photo('requester-1', 'return'));
  returning.update(doc(borrower, 'requests/' + requestId), { stage: 'Return' });
  await assertSucceeds(returning.commit());

  // L7 / LS6: receiving the return without reactivating the listing is forbidden.
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'listings/item-1'), {
      status: 'On Loan', approvedRequestId: requestId,
    });
  });
  await startWindow(owner, 'owner-1');
  const receivingWithoutListing = inTime(writeBatch(owner), owner, 'owner-1');
  receivingWithoutListing.set(doc(owner, 'confirmationPhotos/' + requestId + '_return_owner-1'), photo('owner-1', 'return'));
  receivingWithoutListing.update(doc(owner, 'requests/' + requestId), { stage: 'Received' });
  await assertFails(receivingWithoutListing.commit());

  const receivingWithoutPoints = inTime(writeBatch(owner), owner, 'owner-1');
  receivingWithoutPoints.set(doc(owner, 'confirmationPhotos/' + requestId + '_return_owner-1'), photo('owner-1', 'return'));
  receivingWithoutPoints.update(doc(owner, 'requests/' + requestId), { stage: 'Received' });
  receivingWithoutPoints.update(doc(owner, 'listings/item-1'), { status: 'Active', approvedRequestId: null });
  await assertFails(receivingWithoutPoints.commit());

  const receiving = inTime(writeBatch(owner), owner, 'owner-1');
  receiving.set(doc(owner, 'confirmationPhotos/' + requestId + '_return_owner-1'), photo('owner-1', 'return'));
  receiving.update(doc(owner, 'requests/' + requestId), { stage: 'Received' });
  receiving.update(doc(owner, 'listings/item-1'), { status: 'Active', approvedRequestId: null });
  receiving.update(doc(owner, 'users/owner-1'), { totalPoints: 10, lastPointsRequestId: requestId });
  receiving.update(doc(owner, 'users/requester-1'), { totalPoints: 5, lastPointsRequestId: requestId });
  receiving.set(doc(owner, 'pointsRecords/' + requestId + '_owner-1'), {
    requestId, userId: 'owner-1', points: 10,
    reason: 'Completed borrowing transaction', createdAt: new Date(),
  });
  receiving.set(doc(owner, 'pointsRecords/' + requestId + '_requester-1'), {
    requestId, userId: 'requester-1', points: 5,
    reason: 'Completed borrowing transaction', createdAt: new Date(),
  });
  await assertSucceeds(receiving.commit());

  const [reopened, ownerUser, borrowerUser] = await Promise.all([
    getDoc(doc(owner, 'listings/item-1')),
    getDoc(doc(owner, 'users/owner-1')),
    getDoc(doc(owner, 'users/requester-1')),
  ]);
  if (reopened.data().status !== 'Active') throw new Error('Returned listing was not reactivated.');
  if (ownerUser.data().totalPoints !== 10 || borrowerUser.data().totalPoints !== 5) {
    throw new Error('Completion points were not awarded atomically.');
  }
});

test('unrelated users cannot create transaction confirmation photos', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Approved',
    });
  });
  const outsider = uwContext('outsider');
  await assertFails(setDoc(doc(outsider, 'confirmationPhotos/item-1_requester-1_pickup_outsider'), {
    requestId: 'item-1_requester-1', userId: 'outsider', kind: 'pickup',
    photoUrl: 'https://example.com/photo.jpg', createdAt: new Date(),
  }));
});

test('completion points cannot be awarded later or duplicated after Received', async () => {
  const requestId = 'item-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Received',
    });
    await setDoc(doc(db, 'users/owner-1'), { totalPoints: 10, lastPointsRequestId: requestId });
    await setDoc(doc(db, 'users/requester-1'), { totalPoints: 5, lastPointsRequestId: requestId });
    await setDoc(doc(db, 'pointsRecords/' + requestId + '_owner-1'), {
      requestId, userId: 'owner-1', points: 10,
      reason: 'Completed borrowing transaction', createdAt: new Date(),
    });
  });
  const owner = uwContext('owner-1');
  await assertFails(updateDoc(doc(owner, 'users/owner-1'), { totalPoints: 20 }));
  await assertFails(setDoc(doc(owner, 'pointsRecords/' + requestId + '_requester-1'), {
    requestId, userId: 'requester-1', points: 5,
    reason: 'Completed borrowing transaction', createdAt: new Date(),
  }));

  const requester = uwContext('requester-1');
  const ratingBatch = writeBatch(requester);
  ratingBatch.set(doc(requester, 'ratings/' + requestId + '_requester-1'), {
    requestId, raterId: 'requester-1', rateeId: 'owner-1',
    stars: 5, tags: ['Polite'], createdAt: new Date(),
  });
  ratingBatch.set(doc(requester, 'ratingSummaries/owner-1'), { ratingCount: 1, ratingTotal: 5, overallRating: 5, lastRatingId: requestId + '_requester-1' });
  await assertSucceeds(ratingBatch.commit());
  await assertFails(setDoc(doc(uwContext('outsider'), 'ratings/' + requestId + '_outsider'), {
    requestId, raterId: 'outsider', rateeId: 'owner-1',
    stars: 5, tags: [], createdAt: new Date(),
  }));
});

test('a user cannot increase their points without a completed transaction record', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/requester-1'), { totalPoints: 0 });
  });
  const requester = uwContext('requester-1');
  await assertFails(updateDoc(doc(requester, 'users/requester-1'), { totalPoints: 500 }));
});

test('canceled requests can be re-submitted only with an atomic listing version increment', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Canceled', stage: null,
      createdAt: new Date(), cancelledAt: new Date(),
    });
  });
  const requester = uwContext('requester-1');
  await assertFails(updateDoc(doc(requester, 'requests/item-1_requester-1'), {
    requestEpoch: 0,
  }));
  const batch = writeBatch(requester);
  batch.update(doc(requester, 'listings/item-1'), { requestVersion: 1 });
  batch.update(doc(requester, 'requests/item-1_requester-1'), {
    requestEpoch: 0, status: deleteField(), cancelledAt: null, createdAt: new Date(),
    startDate: '2026-12-20', endDate: '2026-12-22',
    pickupPreference: 'After class', purpose: 'Course project',
  });
  await assertSucceeds(batch.commit());
});

test('borrow requests reject blank fields and invalid dates', async () => {
  const db = uwContext('requester-1');
  const valid = {
    listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
    requesterId: 'requester-1', requestEpoch: 0,
    startDate: '2026-12-20', endDate: '2026-12-22',
    pickupPreference: 'After class', purpose: 'Course project',
  };
  const invalid = [
    { purpose: '   ' },
    { pickupPreference: '' },
    { startDate: '2026-12-22', endDate: '2026-12-20' },
    { startDate: '2026-11-01' },
    { endDate: '2026-02-30' },
    { endDate: '2027-01-05' },
    { startDate: 'tomorrow' },
  ];
  for (const change of invalid) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'listings/item-1'), { requestVersion: 1 });
    batch.set(doc(db, 'requests/item-1_requester-1'), { ...valid, ...change });
    await assertFails(batch.commit());
  }
});

test('only transaction participants can read stored confirmation photos', async () => {
  const requestId = 'item-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Pickup',
    });
    await setDoc(doc(db, 'confirmationPhotos/' + requestId + '_pickup_requester-1'), {
      requestId, userId: 'requester-1', kind: 'pickup',
      photoUrl: 'https://example.com/private.jpg', createdAt: new Date(),
    });
  });
  const photoPath = 'confirmationPhotos/' + requestId + '_pickup_requester-1';
  await assertSucceeds(getDoc(doc(uwContext('owner-1'), photoPath)));
  await assertSucceeds(getDoc(doc(uwContext('requester-1'), photoPath)));
  await assertFails(getDoc(doc(uwContext('outsider'), photoPath)));
});

test('borrower and lender cannot rate before the return is received', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Return',
    });
  });
  await assertFails(setDoc(doc(uwContext('requester-1'), 'ratings/item-1_requester-1_requester-1'), {
    requestId: 'item-1_requester-1', raterId: 'requester-1', rateeId: 'owner-1',
    stars: 5, tags: ['Polite'], createdAt: new Date(),
  }));
});


test('lender cannot reactivate an On Loan listing before receiving the return', async () => {
  const requestId = 'item-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await updateDoc(doc(db, 'listings/item-1'), {
      status: 'On Loan', approvedRequestId: requestId,
    });
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Return',
    });
  });
  await assertFails(updateDoc(doc(uwContext('owner-1'), 'listings/item-1'), {
    status: 'Active', approvedRequestId: null,
  }));
});


test('giveaway pickup awards exactly 15 points atomically and cannot be repeated', async () => {
  const requestId = 'give-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'give-1', listingType: 'give', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Approved',
    });
    await setDoc(doc(db, 'users/owner-1'), { totalPoints: 4 });
  });
  const giver = uwContext('owner-1');
  const requestRef = doc(giver, 'requests/' + requestId);
  const userRef = doc(giver, 'users/owner-1');
  const pointsRef = doc(giver, 'pointsRecords/' + requestId + '_owner-1');
  await assertFails(updateDoc(requestRef, { stage: 'Pickup' }));
  await startWindow(giver, 'owner-1');
  const pickup = inTime(writeBatch(giver), giver, 'owner-1');
  pickup.update(requestRef, { stage: 'Pickup' });
  pickup.update(userRef, { totalPoints: 19, lastPointsRequestId: requestId });
  pickup.set(pointsRef, {
    requestId, userId: 'owner-1', points: 15,
    reason: 'Completed giveaway transaction', createdAt: new Date(),
  });
  await assertSucceeds(pickup.commit());
  const balance = await getDoc(userRef);
  if (balance.data().totalPoints !== 19) throw new Error('Giver did not get 15 points.');
  await assertFails(updateDoc(userRef, { totalPoints: 34 }));
  const record = await getDoc(pointsRef);
  if (record.data().points !== 15) throw new Error('Giveaway points record changed.');
});

test('giver can rate recipient only once after giveaway pickup and advance to Rate', async () => {
  const requestId = 'give-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'give-1', listingType: 'give', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Pickup',
    });
  });
  const giver = uwContext('owner-1');
  const ratingRef = doc(giver, 'ratings/' + requestId + '_owner-1');
  const requestRef = doc(giver, 'requests/' + requestId);
  const rating = {
    requestId, raterId: 'owner-1', rateeId: 'requester-1',
    stars: 5, tags: ['Polite'], createdAt: new Date(),
  };
  await assertFails(setDoc(ratingRef, rating));
  const batch = writeBatch(giver);
  batch.set(ratingRef, rating);
  batch.set(doc(giver, 'ratingSummaries/requester-1'), { ratingCount: 1, ratingTotal: 5, overallRating: 5, lastRatingId: ratingRef.id });
  batch.update(requestRef, { stage: 'Rate' });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(ratingRef, rating));
  await assertFails(setDoc(doc(uwContext('requester-1'), 'ratings/' + requestId + '_requester-1'), {
    ...rating, raterId: 'requester-1', rateeId: 'owner-1',
  }));
});

test('giveaway rating rejects invalid stars, tags and other users', async () => {
  const requestId = 'give-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/' + requestId), {
      listingId: 'give-1', listingType: 'give', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Pickup',
    });
  });
  for (const [stars, tags] of [[0, []], [6, []], [5, ['Invalid tag']]]) {
    const giver = uwContext('owner-1');
    const batch = writeBatch(giver);
    batch.set(doc(giver, 'ratings/' + requestId + '_owner-1'), {
      requestId, raterId: 'owner-1', rateeId: 'requester-1',
      stars, tags, createdAt: new Date(),
    });
    batch.update(doc(giver, 'requests/' + requestId), { stage: 'Rate' });
    await assertFails(batch.commit());
  }
});


test('lending return completes when neither participant has a profile', async () => {
  const requestId = 'item-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await updateDoc(doc(db, 'listings/item-1'), {
      status: 'On Loan', approvedRequestId: requestId,
    });
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Return',
    });
    await setDoc(doc(db, 'confirmationPhotos/' + requestId + '_return_requester-1'), {
      requestId, userId: 'requester-1', kind: 'return',
      photoUrl: 'data:image/jpeg;base64,AAAA', createdAt: new Date(),
    });
  });
  const owner = uwContext('owner-1');
  await startWindow(owner, 'owner-1');
  const receiving = inTime(writeBatch(owner), owner, 'owner-1');
  receiving.set(doc(owner, 'confirmationPhotos/' + requestId + '_return_owner-1'), {
    requestId, userId: 'owner-1', kind: 'return',
    photoUrl: 'data:image/jpeg;base64,AAAA', createdAt: new Date(),
  });
  receiving.update(doc(owner, 'requests/' + requestId), { stage: 'Received' });
  receiving.update(doc(owner, 'listings/item-1'), { status: 'Active', approvedRequestId: null });
  for (const [uid, points] of [['owner-1', 10], ['requester-1', 5]]) {
    receiving.set(doc(owner, 'users/' + uid), { totalPoints: points, lastPointsRequestId: requestId });
    receiving.set(doc(owner, 'pointsRecords/' + requestId + '_' + uid), {
      requestId, userId: uid, points,
      reason: 'Completed borrowing transaction', createdAt: new Date(),
    });
  }
  await assertSucceeds(receiving.commit());
  const borrower = await getDoc(doc(owner, 'users/requester-1'));
  if (borrower.data().totalPoints !== 5) throw new Error('Borrower points missing.');
});

test('giveaway pickup creates missing giver profile and grants points once', async () => {
  const requestId = 'give-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/' + requestId), {
      listingId: 'give-1', listingType: 'give', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Approved',
    });
  });
  const giver = uwContext('owner-1');
  await startWindow(giver, 'owner-1');
  const pickup = inTime(writeBatch(giver), giver, 'owner-1');
  pickup.update(doc(giver, 'requests/' + requestId), { stage: 'Pickup' });
  pickup.set(doc(giver, 'users/owner-1'), { totalPoints: 15, lastPointsRequestId: requestId });
  pickup.set(doc(giver, 'pointsRecords/' + requestId + '_owner-1'), {
    requestId, userId: 'owner-1', points: 15,
    reason: 'Completed giveaway transaction', createdAt: new Date(),
  });
  await assertSucceeds(pickup.commit());
  const user = await getDoc(doc(giver, 'users/owner-1'));
  if (user.data().totalPoints !== 15) throw new Error('Giveaway points missing.');
});


test('NF9 / G4.11 a pickup commit that lands after the save window is rejected and changes nothing', async () => {
  const requestId = 'give-1_requester-1';
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/' + requestId), {
      listingId: 'give-1', listingType: 'give', ownerId: 'owner-1',
      requesterId: 'requester-1', status: 'Approved', stage: 'Approved',
    });
    await setDoc(doc(db, 'users/owner-1'), { totalPoints: 75 });
    // The save started 16 seconds ago; the client has already shown "Saving timed out".
    await setDoc(doc(db, 'saveAttempts/owner-1'), {
      startedAt: Timestamp.fromMillis(Date.now() - 16000),
    });
  });
  const giver = uwContext('owner-1');
  const latePickup = () => {
    const batch = inTime(writeBatch(giver), giver, 'owner-1');
    batch.update(doc(giver, 'requests/' + requestId), { stage: 'Pickup' });
    batch.update(doc(giver, 'users/owner-1'), { totalPoints: 90, lastPointsRequestId: requestId });
    batch.set(doc(giver, 'pointsRecords/' + requestId + '_owner-1'), {
      requestId, userId: 'owner-1', points: 15,
      reason: 'Completed giveaway transaction', createdAt: new Date(),
    });
    return batch;
  };
  await assertFails(latePickup().commit());
  // A commit cannot claim a longer window than the client timeout either.
  const tooLong = writeBatch(giver);
  tooLong.update(doc(giver, 'saveAttempts/owner-1'), { windowMs: 60000, consumedAt: serverTimestamp() });
  tooLong.update(doc(giver, 'requests/' + requestId), { stage: 'Pickup' });
  await assertFails(tooLong.commit());
  // Skipping the save window entirely is rejected.
  const noWindow = writeBatch(giver);
  noWindow.update(doc(giver, 'requests/' + requestId), { stage: 'Pickup' });
  noWindow.update(doc(giver, 'users/owner-1'), { totalPoints: 90, lastPointsRequestId: requestId });
  noWindow.set(doc(giver, 'pointsRecords/' + requestId + '_owner-1'), {
    requestId, userId: 'owner-1', points: 15,
    reason: 'Completed giveaway transaction', createdAt: new Date(),
  });
  await assertFails(noWindow.commit());
  equal((await getDoc(doc(giver, 'requests/' + requestId))).data().stage, 'Approved');
  equal((await getDoc(doc(giver, 'users/owner-1'))).data().totalPoints, 75);
  // A window that has already been used cannot be reused for a later commit.
  await startWindow(giver, 'owner-1');
  await assertSucceeds(latePickup().commit());
  await assertFails(inTime(writeBatch(giver), giver, 'owner-1').commit());
});

test('cancellation save timeout returns a clear error instead of hanging', async () => {
  await rejects(
    saveWithTimeout(() => new Promise(() => {}), 5),
    /Saving timed out/,
  );
});

test('a failed cancellation must not change the pending request in Firestore', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId: 'requester-1', requestEpoch: 0,
    });
  });
  const outsider = uwContext('requester-2');
  await assertFails(updateDoc(doc(outsider, 'requests/item-1_requester-1'), {
    status: 'Canceled', cancelledAt: new Date(),
  }));
  const requester = uwContext('requester-1');
  const current = await getDoc(doc(requester, 'requests/item-1_requester-1'));
  if (requestStatus(current.data(), listing) !== 'Pending') throw new Error('Failed cancellation changed request status.');
});

test('giver may check a missing points record before the first pickup', async () => {
  const giver = uwContext('owner-1');
  const missing = await assertSucceeds(getDoc(doc(giver, 'pointsRecords/give-1_requester-1_owner-1')));
  if (missing.exists()) throw new Error('Unexpected points record.');
});

test('existing points records remain private to their recipient', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'pointsRecords/other-request_owner-1'), {
      requestId: 'other-request', userId: 'owner-1', points: 15,
      reason: 'Completed giveaway transaction',
    });
  });
  await assertSucceeds(getDoc(doc(uwContext('owner-1'), 'pointsRecords/other-request_owner-1')));
  await assertFails(getDoc(doc(uwContext('requester-1'), 'pointsRecords/other-request_owner-1')));
});
// Sprint 2 QA (#21/#22): the giveaway pickup transaction reads the giver's
// points record before it exists. That read must be allowed, or Firestore
// rejects the whole pickup.
test('users can check their own missing points record but not others', async () => {
  const requestId = 'item-1_requester-1';
  const giver = uwContext('owner-1');
  await assertSucceeds(getDoc(doc(giver, 'pointsRecords/' + requestId + '_owner-1')));
  await assertFails(getDoc(doc(giver, 'pointsRecords/' + requestId + '_requester-1')));

  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'pointsRecords/' + requestId + '_requester-1'), {
      requestId, userId: 'requester-1', points: 5,
      reason: 'Completed borrowing transaction', createdAt: new Date(),
    });
  });
  await assertFails(getDoc(doc(giver, 'pointsRecords/' + requestId + '_requester-1')));
  await assertSucceeds(getDoc(doc(uwContext('requester-1'), 'pointsRecords/' + requestId + '_requester-1')));
});

async function seedRatingRequest(id, requesterId = 'requester-1') {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/' + id), {
      listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
      requesterId, status: 'Approved', stage: 'Received',
    });
  });
}

function ratingWrite(db, requestId, stars, summary) {
  const batch = writeBatch(db);
  const id = requestId + '_requester-1';
  batch.set(doc(db, 'ratings/' + id), {
    requestId, raterId: 'requester-1', rateeId: 'owner-1', stars, tags: [], createdAt: new Date(),
  });
  if (summary) batch.set(doc(db, 'ratingSummaries/owner-1'), { ...summary, lastRatingId: id });
  return batch.commit();
}

test('R8 requires atomic summary, rounds halves up, and rejects replay or forged totals', async () => {
  await seedRatingRequest('rating-a');
  await seedRatingRequest('rating-b');
  const db = uwContext('requester-1');
  await assertFails(ratingWrite(db, 'rating-a', 4));
  await assertFails(ratingWrite(db, 'rating-a', 4, { ratingCount: 1, ratingTotal: 5, overallRating: 5 }));
  await assertSucceeds(ratingWrite(db, 'rating-a', 4, { ratingCount: 1, ratingTotal: 4, overallRating: 4 }));
  await assertFails(ratingWrite(db, 'rating-a', 4, { ratingCount: 2, ratingTotal: 8, overallRating: 4 }));
  await assertFails(ratingWrite(db, 'rating-b', 5, { ratingCount: 2, ratingTotal: 9, overallRating: 4 }));
  await assertSucceeds(ratingWrite(db, 'rating-b', 5, { ratingCount: 2, ratingTotal: 9, overallRating: 5 }));
  equal((await getDoc(doc(db, 'ratingSummaries/owner-1'))).data().overallRating, 5);
  await assertFails(updateDoc(doc(uwContext('owner-1'), 'ratingSummaries/owner-1'), { overallRating: 1 }));
});

test('R8 rejects a stale concurrent total without leaving a rating behind', async () => {
  await seedRatingRequest('rating-a');
  await seedRatingRequest('rating-b');
  const db = uwContext('requester-1');
  const results = await Promise.allSettled([
    ratingWrite(db, 'rating-a', 4, { ratingCount: 1, ratingTotal: 4, overallRating: 4 }),
    ratingWrite(db, 'rating-b', 4, { ratingCount: 1, ratingTotal: 4, overallRating: 4 }),
  ]);
  equal(results.filter(result => result.status === 'fulfilled').length, 1);
  equal((await getDoc(doc(db, 'ratingSummaries/owner-1'))).data().ratingCount, 1);
});

test('LS9 worker persists expiry without a page visit and is idempotent', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required');
  const app = initializeAdminApp({ projectId }, 'expiry-test');
  try {
    const db = getFirestore(app);
    await db.doc('listings/expired').set({ ...listing, availableUntil: '2026-07-01' });
    await db.doc('listings/today').set({ ...listing, availableUntil: '2026-07-02' });
    await db.doc('listings/loan').set({ ...listing, status: 'On Loan', availableUntil: '2026-07-01' });
    const now = new Date('2026-07-02T07:00:00Z');
    equal(await expireListings(db, now), 1);
    equal((await db.doc('listings/expired').get()).data().status, 'Inactive');
    equal((await db.doc('listings/today').get()).data().status, 'Active');
    equal((await db.doc('listings/loan').get()).data().status, 'On Loan');
    equal(await expireListings(db, now), 0);
  } finally {
    await deleteApp(app);
  }
});

// LS4: a valid owner must not bypass the all-pending decision by using the SDK.
test('LS4 rejects an approval that omits another pending request', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'listings/item-1'), { ...listing, type: 'sell' });
    for (const uid of ['requester-1', 'requester-2']) {
      await setDoc(doc(db, `requests/item-1_${uid}`), {
        listingId: 'item-1', listingType: 'sell', ownerId: 'owner-1',
        requesterId: uid, requestEpoch: 0,
      });
    }
  });
  const owner = uwContext('owner-1');
  const batch = writeBatch(owner);
  batch.update(doc(owner, 'requests/item-1_requester-1'), {
    status: 'Approved', pickupDate: '2026-12-20', pickupTime: '15:00',
    pickupLocation: 'Suzzallo Library',
  });
  batch.update(doc(owner, 'listings/item-1'), {
    status: 'Sold', approvedRequestId: 'item-1_requester-1',
  });
  await assertFails(batch.commit());
  equal(requestStatus((await getDoc(doc(owner, 'requests/item-1_requester-1'))).data(), listing), 'Pending');
  equal(requestStatus((await getDoc(doc(owner, 'requests/item-1_requester-2'))).data(), listing), 'Pending');
  equal((await getDoc(doc(owner, 'listings/item-1'))).data().status, 'Active');
});

async function seedCompetition(type = 'sell', count = 3) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'listings/item-1'), { ...listing, type });
    for (let index = 1; index <= count; index++) {
      await setDoc(doc(db, `requests/item-1_requester-${index}`), {
        listingId: 'item-1', listingType: type, ownerId: 'owner-1',
        requesterId: `requester-${index}`, requestEpoch: 0, viewedByOwner: false,
      });
    }
  });
}

const pickupDetails = { date: '2026-12-20', time: '15:00', location: 'Suzzallo Library' };

async function readStatuses(db, count) {
  const item = (await getDoc(doc(db, 'listings/item-1'))).data();
  return Promise.all(Array.from({ length: count }, async (_, index) => {
    const row = (await getDoc(doc(db, `requests/item-1_requester-${index + 1}`))).data();
    return requestStatus(row, item);
  }));
}

for (const type of ['sell', 'give', 'lend']) {
  test(`LS4 real approval helper atomically decides all ${type} requests`, async () => {
    await seedCompetition(type, 4);
    const owner = uwContext('owner-1');
    equal(await decideItemRequestInDatabase(owner, 'item-1_requester-2', 'owner-1', 'approve', pickupDetails), 'Approved');
    deepEqual(await readStatuses(owner, 4), ['Declined', 'Approved', 'Declined', 'Declined']);
    equal((await getDoc(doc(owner, 'listings/item-1'))).data().status,
      { sell: 'Sold', give: 'Given Away', lend: 'On Loan' }[type]);
  });
}

test('LS4 direct SDK approval seals all 60 rivals without writing their documents', async () => {
  await seedCompetition('sell', 61);
  const owner = uwContext('owner-1');
  const batch = writeBatch(owner);
  batch.update(doc(owner, 'requests/item-1_requester-1'), {
    status: 'Approved', pickupDate: pickupDetails.date, pickupTime: pickupDetails.time,
    pickupLocation: pickupDetails.location,
  });
  batch.update(doc(owner, 'listings/item-1'), {
    status: 'Sold', approvedRequestId: 'item-1_requester-1', approvalEpoch: 1,
  });
  await assertSucceeds(batch.commit());
  deepEqual(await readStatuses(owner, 61), ['Approved', ...Array(60).fill('Declined')]);
  const rival = (await getDoc(doc(owner, 'requests/item-1_requester-2'))).data();
  equal('status' in rival, false); // No misleading persisted Pending shadow field.
  await assertFails(updateDoc(doc(uwContext('requester-2'), 'requests/item-1_requester-2'), { status: 'Canceled' }));
  await assertFails(updateDoc(doc(owner, 'requests/item-1_requester-2'), { status: 'Approved' }));
});

test('LS4 concurrent approvals produce one winner and no Pending requests', async () => {
  await seedCompetition();
  const owner = uwContext('owner-1');
  const results = await Promise.allSettled([1, 2].map(index =>
    decideItemRequestInDatabase(owner, `item-1_requester-${index}`, 'owner-1', 'approve', pickupDetails)));
  equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const statuses = await readStatuses(owner, 3);
  equal(statuses.filter(status => status === 'Approved').length, 1);
  equal(statuses.filter(status => status === 'Declined').length, 2);
});

test('LS4 request submission racing approval either fails atomically or is declined', async () => {
  await seedCompetition('sell', 1);
  const requester = uwContext('requester-2');
  const owner = uwContext('owner-1');
  const submit = runTransaction(requester, async tx => {
    const ref = doc(requester, 'listings/item-1');
    const snap = await tx.get(ref);
    if (snap.data().status !== 'Active') throw new Error('Unavailable');
    tx.update(ref, { requestVersion: (snap.data().requestVersion || 0) + 1 });
    tx.set(doc(requester, 'requests/item-1_requester-2'), {
      listingId: 'item-1', listingType: 'sell', ownerId: 'owner-1',
      requesterId: 'requester-2', requestEpoch: snap.data().approvalEpoch,
    });
  });
  const results = await Promise.allSettled([submit,
    decideItemRequestInDatabase(owner, 'item-1_requester-1', 'owner-1', 'approve', pickupDetails)]);
  equal(results[1].status, 'fulfilled');
  const rival = await getDoc(doc(owner, 'requests/item-1_requester-2'));
  if (rival.exists()) {
    equal(requestStatus(rival.data(), (await getDoc(doc(owner, 'listings/item-1'))).data()), 'Declined');
  } else equal(results[0].status, 'rejected');
});

test('LS4 cancellation racing approval preserves cancellation or a single approved winner', async () => {
  await seedCompetition();
  const owner = uwContext('owner-1');
  const results = await Promise.allSettled([
    updateDoc(doc(uwContext('requester-1'), 'requests/item-1_requester-1'), { status: 'Canceled' }),
    decideItemRequestInDatabase(owner, 'item-1_requester-1', 'owner-1', 'approve', pickupDetails),
  ]);
  const statuses = await readStatuses(owner, 3);
  if (statuses[0] === 'Canceled') {
    equal(results[1].status, 'rejected'); deepEqual(statuses, ['Canceled', 'Pending', 'Pending']);
  } else {
    equal(results[0].status, 'rejected'); deepEqual(statuses, ['Approved', 'Declined', 'Declined']);
  }
});

test('LS4 rejects forged epoch changes, legacy writes and multiple winners without partial saves', async () => {
  await seedCompetition();
  const owner = uwContext('owner-1');
  for (const patch of [{ approvalEpoch: 1 }, { approvalEpoch: -1 }, { requestSchemaVersion: 1 }]) {
    await assertFails(updateDoc(doc(owner, 'listings/item-1'), patch));
  }
  await assertFails(deleteDoc(doc(owner, 'listings/item-1')));
  await assertFails(updateDoc(doc(owner, 'requests/item-1_requester-2'), { requestEpoch: 1 }));
  await assertFails(updateDoc(doc(uwContext('requester-2'), 'requests/item-1_requester-2'), { status: 'Pending' }));
  const batch = writeBatch(owner);
  for (const id of [1, 2]) batch.update(doc(owner, `requests/item-1_requester-${id}`), {
    status: 'Approved', pickupDate: pickupDetails.date, pickupTime: pickupDetails.time, pickupLocation: pickupDetails.location,
  });
  batch.update(doc(owner, 'listings/item-1'), { status: 'Sold', approvedRequestId: 'item-1_requester-1', approvalEpoch: 1 });
  await assertFails(batch.commit());
  deepEqual(await readStatuses(owner, 3), ['Pending', 'Pending', 'Pending']);
  equal((await getDoc(doc(owner, 'listings/item-1'))).data().approvalEpoch, 0);
});

test('NF9 invalid pickup and denied approval leave every request and the listing unchanged', async () => {
  await seedCompetition();
  const owner = uwContext('owner-1');
  for (const patch of [{ date: '' }, { time: '' }, { location: '' }, { date: '2026-02-30' }]) {
    await rejects(decideItemRequestInDatabase(owner, 'item-1_requester-1', 'owner-1', 'approve', { ...pickupDetails, ...patch }));
  }
  await rejects(decideItemRequestInDatabase(uwContext('requester-1'), 'item-1_requester-1', 'owner-1', 'approve', pickupDetails));
  deepEqual(await readStatuses(owner, 3), ['Pending', 'Pending', 'Pending']);
  equal((await getDoc(doc(owner, 'listings/item-1'))).data().status, 'Active');
});

test('LS4 old declines do not revive after a lending listing reopens', async () => {
  await seedCompetition('lend');
  const owner = uwContext('owner-1');
  await decideItemRequestInDatabase(owner, 'item-1_requester-1', 'owner-1', 'approve', pickupDetails);
  // The existing Received/points regression covers the legitimate reactivation write.
  // This fixture isolates the persisted epoch across reactivation and a later cycle.
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'listings/item-1'), { status: 'Active', approvedRequestId: null });
  });
  deepEqual(await readStatuses(owner, 3), ['Approved', 'Declined', 'Declined']);
  await rejects(decideItemRequestInDatabase(owner, 'item-1_requester-2', 'owner-1', 'approve', pickupDetails));
  const requester = uwContext('requester-2');
  const batch = writeBatch(requester);
  batch.update(doc(requester, 'listings/item-1'), { requestVersion: 1 });
  batch.update(doc(requester, 'requests/item-1_requester-2'), { requestEpoch: 1 });
  await assertFails(batch.commit());
});

test('H4 all unviewed requests remain counted after epoch approval and can still be marked viewed', async () => {
  await seedCompetition();
  const owner = uwContext('owner-1');
  const unread = query(collection(owner, 'requests'), where('ownerId', '==', 'owner-1'), where('viewedByOwner', '==', false));
  equal((await getDocs(unread)).size, 3);
  await decideItemRequestInDatabase(owner, 'item-1_requester-1', 'owner-1', 'approve', pickupDetails);
  equal((await getDocs(unread)).size, 3);
  for (const row of (await getDocs(unread)).docs) await assertSucceeds(updateDoc(row.ref, { viewedByOwner: true }));
  equal((await getDocs(unread)).size, 0);
});

test('legacy epoch migration is dry-run safe, repairs old stragglers and resumes idempotently', async () => {
  const app = initializeAdminApp({ projectId }, 'epoch-migration');
  try {
    const db = getFirestore(app);
    await db.doc('listings/item-1').set({ ...listing, requestSchemaVersion: 1, type: 'sell', status: 'Sold', approvedRequestId: 'item-1_requester-1' });
    for (const index of [1, 2]) await db.doc(`requests/item-1_requester-${index}`).set({
      listingId: 'item-1', listingType: 'sell', ownerId: 'owner-1', requesterId: `requester-${index}`,
      status: index === 1 ? 'Approved' : 'Pending', viewedByOwner: false,
    });
    const before = (await db.doc('requests/item-1_requester-2').get()).data();
    equal((await migrateRequestEpochs(db)).listings, 1);
    deepEqual((await db.doc('requests/item-1_requester-2').get()).data(), before);
    await migrateRequestEpochs(db, { apply: true });
    deepEqual(await readStatuses(uwContext('owner-1'), 2), ['Approved', 'Declined']);
    equal((await db.doc('requests/item-1_requester-2').get()).data().viewedByOwner, false);
    equal((await migrateRequestEpochs(db, { apply: true })).listings, 0);
  } finally { await deleteApp(app); }
});


test('migration preserves an empty legacy Unavailable listing without inventing a winner', async () => {
  const app = initializeAdminApp({ projectId }, 'empty-legacy');
  try {
    const db = getFirestore(app);
    await db.doc('listings/empty-legacy').set({ OwnerId: 'owner-1', type: 'give', status: 'Unavailable', title: 'Old seed' });
    await migrateRequestEpochs(db, { apply: true });
    const item = (await db.doc('listings/empty-legacy').get()).data();
    equal(item.status, 'Unavailable'); equal(item.approvalEpoch, 0);
    equal(item.requestSchemaVersion, 2); equal('approvedRequestId' in item, false);
  } finally { await deleteApp(app); }
});
