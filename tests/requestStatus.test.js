import { test } from 'node:test';
import { equal, throws } from 'node:assert/strict';
import { requestStatus, requireRequestSchema } from '../src/data/requestStatus.js';

test('epoch status is a persisted decision that survives reopening and later approvals', () => {
  const request = { requestEpoch: 0 };
  equal(requestStatus(request, { approvalEpoch: 0 }), 'Pending');
  equal(requestStatus(request, { approvalEpoch: 1, status: 'Sold' }), 'Declined');
  equal(requestStatus(request, { approvalEpoch: 1, status: 'Active' }), 'Declined');
  equal(requestStatus(request, { approvalEpoch: 10 }), 'Declined');
  for (const status of ['Approved', 'Canceled', 'Declined']) {
    equal(requestStatus({ ...request, status }, { approvalEpoch: 10 }), status);
  }
});

test('missing or invalid epoch data never defaults to Pending', () => {
  for (const [request, listing] of [[{}, {}], [{ requestEpoch: 1 }, { approvalEpoch: 0 }],
    [{ requestEpoch: 0 }, null], [{ requestEpoch: -1 }, { approvalEpoch: 0 }]]) {
    throws(() => requestStatus(request, listing));
  }
  throws(() => requireRequestSchema({ approvalEpoch: 0 }));
  throws(() => requireRequestSchema({ requestSchemaVersion: 2, approvalEpoch: -1 }));
});
