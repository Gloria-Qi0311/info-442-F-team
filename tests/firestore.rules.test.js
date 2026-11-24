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
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { rejects, equal } from 'node:assert/strict';
import { saveWithTimeout } from '../src/data/saveWithTimeout.js';

const projectId = 'demo-husky-share';
let testEnv;

const listing = {
  ownerId: 'owner-1',
  type: 'lend',
  status: 'Active',
  title: 'Test item',
  availableFrom: '2026-11-01',
  availableUntil: '2026-12-31',
};

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
    status: 'Pending',
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
    status: 'Pending',
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
    status: 'Pending',
  }));
});

test('a requester cannot read or change another requester\'s request', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'requests/item-1_requester-1'), {
      listingId: 'item-1',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      status: 'Pending',
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
      status: 'Pending',
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
    status: 'On Loan',
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
      status: 'Pending',
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
      status: 'Pending',
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
    status: 'Pending',
  }));

  const requester = uwContext('requester-1');
  await assertFails(setDoc(doc(requester, 'requests/item-2_requester-1'), {
    listingId: 'item-2',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'requester-1',
    status: 'Pending',
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
      status: 'Pending',
    });
    await setDoc(doc(db, 'requests/item-1_requester-2'), {
      listingId: 'item-1',
      listingType: 'lend',
      ownerId: 'owner-1',
      requesterId: 'requester-2',
      status: 'Pending',
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
    status: 'On Loan',
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
        status: 'Pending',
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
      status: expectedStatus,
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
  await assertSucceeds(setDoc(doc(borrower, 'confirmationPhotos/' + requestId + '_pickup_requester-1'), photo('requester-1', 'pickup')));
  await assertFails(updateDoc(doc(borrower, 'requests/' + requestId), { stage: 'Pickup' }));

  const pickup = writeBatch(owner);
  pickup.set(doc(owner, 'confirmationPhotos/' + requestId + '_pickup_owner-1'), photo('owner-1', 'pickup'));
  pickup.update(doc(owner, 'requests/' + requestId), { stage: 'Pickup' });
  await assertSucceeds(pickup.commit());

  await assertFails(updateDoc(doc(owner, 'requests/' + requestId), { stage: 'Received' }));
  const returning = writeBatch(borrower);
  returning.set(doc(borrower, 'confirmationPhotos/' + requestId + '_return_requester-1'), photo('requester-1', 'return'));
  returning.update(doc(borrower, 'requests/' + requestId), { stage: 'Return' });
  await assertSucceeds(returning.commit());

  // L7 / LS6: receiving the return without reactivating the listing is forbidden.
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'listings/item-1'), {
      status: 'On Loan', approvedRequestId: requestId,
    });
  });
  const receivingWithoutListing = writeBatch(owner);
  receivingWithoutListing.set(doc(owner, 'confirmationPhotos/' + requestId + '_return_owner-1'), photo('owner-1', 'return'));
  receivingWithoutListing.update(doc(owner, 'requests/' + requestId), { stage: 'Received' });
  await assertFails(receivingWithoutListing.commit());

  const receivingWithoutPoints = writeBatch(owner);
  receivingWithoutPoints.set(doc(owner, 'confirmationPhotos/' + requestId + '_return_owner-1'), photo('owner-1', 'return'));
  receivingWithoutPoints.update(doc(owner, 'requests/' + requestId), { stage: 'Received' });
  receivingWithoutPoints.update(doc(owner, 'listings/item-1'), { status: 'Active', approvedRequestId: null });
  await assertFails(receivingWithoutPoints.commit());

  const receiving = writeBatch(owner);
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
    status: 'Pending',
  }));
  const batch = writeBatch(requester);
  batch.update(doc(requester, 'listings/item-1'), { requestVersion: 1 });
  batch.update(doc(requester, 'requests/item-1_requester-1'), {
    status: 'Pending', cancelledAt: null, createdAt: new Date(),
    startDate: '2026-12-20', endDate: '2026-12-22',
    pickupPreference: 'After class', purpose: 'Course project',
  });
  await assertSucceeds(batch.commit());
});

test('borrow requests reject blank fields and invalid dates', async () => {
  const db = uwContext('requester-1');
  const valid = {
    listingId: 'item-1', listingType: 'lend', ownerId: 'owner-1',
    requesterId: 'requester-1', status: 'Pending',
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
  const pickup = writeBatch(giver);
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
  const receiving = writeBatch(owner);
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
  const pickup = writeBatch(giver);
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
      requesterId: 'requester-1', status: 'Pending',
    });
  });
  const outsider = uwContext('requester-2');
  await assertFails(updateDoc(doc(outsider, 'requests/item-1_requester-1'), {
    status: 'Canceled', cancelledAt: new Date(),
  }));
  const requester = uwContext('requester-1');
  const current = await getDoc(doc(requester, 'requests/item-1_requester-1'));
  if (current.data().status !== 'Pending') throw new Error('Failed cancellation changed request status.');
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
