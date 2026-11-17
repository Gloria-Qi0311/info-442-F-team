import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
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
  const batch = writeBatch(db);
  batch.update(doc(db, 'listings/item-1'), { requestVersion: 1 });
  batch.set(doc(db, 'requests/item-1_requester-1'), {
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
  });
  await assertSucceeds(batch.commit());
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
