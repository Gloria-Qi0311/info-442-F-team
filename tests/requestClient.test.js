import net from 'node:net';
import { test, before, after } from 'node:test';
import { equal, deepEqual, rejects } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

let env;
let proxy;
let offline = false;
const sockets = new Set();
const servers = [];
const clients = {};
const fixture = { ownerId: 'owner', type: 'sell', title: 'Client regression', status: 'Active',
  requestSchemaVersion: 2, approvalEpoch: 0, availableUntil: '2026-12-31' };
before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  proxy = net.createServer(socket => {
    if (offline) { socket.destroy(); return; }
    const upstream = net.connect(Number(port), host);
    for (const connection of [socket, upstream]) {
      sockets.add(connection);
      connection.on('close', () => sockets.delete(connection));
      connection.on('error', () => { socket.destroy(); upstream.destroy(); });
    }
    socket.pipe(upstream); upstream.pipe(socket);
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  env = await initializeTestEnvironment({ projectId: 'demo-husky-share',
    firestore: { host: '127.0.0.1', port: proxy.address().port, rules: await readFile('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  globalThis.__requestTestDatabases = {};
  for (const uid of ['owner', 'alice', 'bob']) {
    const db = env.authenticatedContext(uid, { email: `${uid}@uw.edu`, email_verified: true }).firestore();
    globalThis.__requestTestDatabases[uid] = db;
    const server = await createServer({ configFile: false, appType: 'custom',
      server: { middlewareMode: true, hmr: { port: 24700 + servers.length } },
      plugins: [{ name: 'test-database', enforce: 'pre',
        resolveId(id) { if (id === '../firebase' || /\/src\/firebase(?:\.js)?$/.test(id)) return '\0test-database'; },
        load(id) { if (id === '\0test-database') return `export const db = globalThis.__requestTestDatabases[${JSON.stringify(uid)}];`; },
      }],
    });
    servers.push(server);
    clients[uid] = { db,
      requests: await server.ssrLoadModule('/src/data/requests.js'),
      borrow: await server.ssrLoadModule('/src/data/borrowRequests.js'),
      decisions: await server.ssrLoadModule('/src/data/requestDecisions.js'),
      progress: await server.ssrLoadModule('/src/data/transactionProgress.js') };
  }
});
after(async () => {
  await Promise.all(servers.map(server => server.close()));
  await env?.cleanup();
  for (const socket of sockets) socket.destroy();
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  delete globalThis.__requestTestDatabases;
});

async function seed(id, extra = {}) {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'listings', id), { ...fixture, ...extra }));
}
function nextValue(subscribe, matches) {
  let stop = () => {};
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('Listener did not receive expected committed state')); }, 5000);
    stop = subscribe(value => {
      if (matches(value)) { clearTimeout(timer); stop(); resolve(value); }
    }, error => { clearTimeout(timer); stop(); reject(error); });
  });
  return promise;
}

test('real client submission, cancellation, resubmission, approval and live rival status', async () => {
  await step('seed', () => seed('client-sell'));
  const { alice, bob, owner } = clients;
  await step('alice submit', () => alice.requests.sendItemRequest('client-sell', { uid: 'alice' }));
  await step('bob submit', () => bob.requests.sendItemRequest('client-sell', { uid: 'bob' }));
  equal((await alice.requests.getMyRequest('client-sell', 'alice')).status, 'Pending');
  await alice.requests.cancelItemRequest('client-sell_alice', 'alice');
  equal((await alice.requests.getMyRequest('client-sell', 'alice')).status, 'Canceled');
  await step('alice submit', () => alice.requests.sendItemRequest('client-sell', { uid: 'alice' }));
  const rivalStatus = nextValue((change, error) => bob.requests.watchRequest('client-sell_bob', change, error), row => row?.status === 'Declined');
  const ownerList = nextValue((change, error) => owner.requests.watchRequestsForListing('client-sell', 'owner', change, error), rows =>
    rows.length === 2 && rows.some(row => row.status === 'Approved') && rows.some(row => row.status === 'Declined'));
  await owner.decisions.decideItemRequest('client-sell_alice', 'owner', 'approve', { date: '2026-12-20', time: '15:00', location: 'Library' });
  equal((await rivalStatus).status, 'Declined');
  equal((await ownerList).length, 2);
  equal((await bob.requests.getMySentRequests('bob'))[0].status, 'Declined');
  equal((await owner.requests.getRequestsForListing('client-sell', 'owner')).filter(row => row.status === 'Pending').length, 0);
  await rejects(bob.requests.cancelItemRequest('client-sell_bob', 'bob'));
  await rejects(bob.requests.sendItemRequest('client-sell', { uid: 'bob' }));
  equal(await nextValue(change => owner.requests.watchUnviewedRequestCount('owner', change), count => count === 2), 2);
  await owner.requests.markRequestsViewed(await owner.requests.getRequestsForListing('client-sell', 'owner'));
  equal(await nextValue(change => owner.requests.watchUnviewedRequestCount('owner', change), count => count === 0), 0);
});

test('real borrowing client preserves cancel/resubmit and declines all other requests', async () => {
  await seed('client-lend', { type: 'lend', availableFrom: '2026-11-01' });
  const values = { startDate: '2026-12-20', endDate: '2026-12-22', pickupPreference: 'After class', purpose: 'Project' };
  for (const uid of ['alice', 'bob']) await clients[uid].borrow.sendBorrowRequest('client-lend', { uid }, values);
  await clients.alice.requests.cancelItemRequest('client-lend_alice', 'alice');
  await clients.alice.borrow.sendBorrowRequest('client-lend', { uid: 'alice' }, values);
  await clients.owner.decisions.decideItemRequest('client-lend_alice', 'owner', 'approve', { date: '2026-12-20', time: '15:00', location: 'Library' });
  equal((await clients.bob.borrow.getBorrowRequest('client-lend', 'bob')).status, 'Declined');
  equal((await clients.alice.borrow.getBorrowRequest('client-lend', 'alice')).status, 'Approved');
});

test('NF9 real approval transaction fails offline without any partial decision', async () => {
  await seed('client-offline');
  await clients.alice.requests.sendItemRequest('client-offline', { uid: 'alice' });
  await clients.bob.requests.sendItemRequest('client-offline', { uid: 'bob' });
  const { owner } = clients;
  offline = true;
  for (const socket of sockets) socket.destroy();
  try {
    await rejects(owner.decisions.decideItemRequest('client-offline_alice', 'owner', 'approve', { date: '2026-12-20', time: '15:00', location: 'Library' }));
  } finally { offline = false; }
  deepEqual((await owner.requests.getRequestsForListing('client-offline', 'owner')).map(row => row.status), ['Pending', 'Pending']);
  equal((await getDoc(doc(owner.db, 'listings/client-offline'))).data().approvalEpoch, 0);
});

test('NF9 / G4.11 real giveaway pickup saves only inside the save window', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'requests/give-window_alice'), { listingId: 'give-window', listingType: 'give',
      ownerId: 'owner', requesterId: 'alice', status: 'Approved', stage: 'Approved' });
    await setDoc(doc(db, 'users/owner'), { totalPoints: 60 });
  });
  const { owner } = clients;
  // The client deadline has passed before the commit can be sent: nothing is saved.
  await rejects(owner.progress.confirmSellGivePickup('give-window_alice', 'owner', () => false, Date.now() - 1));
  equal((await getDoc(doc(owner.db, 'requests/give-window_alice'))).data().stage, 'Approved');
  equal((await getDoc(doc(owner.db, 'users/owner'))).data().totalPoints, 60);
  await owner.progress.confirmSellGivePickup('give-window_alice', 'owner', () => false, Date.now() + 15000);
  equal((await getDoc(doc(owner.db, 'requests/give-window_alice'))).data().stage, 'Pickup');
  equal((await getDoc(doc(owner.db, 'users/owner'))).data().totalPoints, 75);
});

async function step(label, run) { try { return await run(); } catch (cause) { throw new Error(label, { cause }); } }
