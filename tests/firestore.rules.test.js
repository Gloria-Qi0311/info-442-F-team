import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

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
  await assertSucceeds(setDoc(doc(db, 'requests/item-1_requester-1'), {
    listingId: 'item-1',
    listingType: 'lend',
    ownerId: 'owner-1',
    requesterId: 'requester-1',
    status: 'Pending',
    startDate: '2026-11-20',
    endDate: '2026-11-22',
    pickupPreference: 'After class',
    purpose: 'Course project',
    listingTitle: 'Test item',
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

test('only the listing owner can atomically approve and mark the listing unavailable', async () => {
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
    status: 'Unavailable',
    approvedRequestId: 'item-1_requester-1',
  });
  await assertSucceeds(batch.commit());
});
