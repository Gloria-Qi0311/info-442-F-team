import { FieldValue } from 'firebase-admin/firestore';

// Rules v2 must be deployed BEFORE --apply: legacy submissions/decisions are
// fail-closed until the listing is marked ready. Existing terminal transactions
// and H4 viewed flags remain usable. Dry-run performs no writes.
export async function migrateRequestEpochs(db, { apply = false } = {}) {
  const listings = await db.collection('listings').get();
  const requests = await db.collection('requests').get();
  const byListing = new Map(listings.docs.map(snap => [snap.id, []]));
  for (const request of requests.docs) {
    const row = request.data();
    if (!byListing.has(row.listingId)) throw new Error(`Orphan request ${request.id}; repair before migration.`);
    byListing.get(row.listingId).push(request);
  }
  const plans = [];
  for (const item of listings.docs) {
    const listing = item.data();
    const rows = byListing.get(item.id);
    if (listing.requestSchemaVersion === 2) {
      if (!Number.isSafeInteger(listing.approvalEpoch) || listing.approvalEpoch < 0) throw new Error(`Invalid epoch: ${item.id}`);
      if (rows.some(row => row.data().status === 'Pending')) throw new Error(`Legacy Pending on migrated listing: ${item.id}`);
      continue;
    }
    // Old seed data may contain Unavailable listings with no requests at all.
    // Preserve these as unavailable; there is no pending decision to migrate.
    const closed = rows.length > 0 && ['On Loan', 'Sold', 'Given Away', 'Unavailable'].includes(listing.status);
    if (closed) {
      const winner = rows.find(row => row.id === listing.approvedRequestId)?.data();
      if (!winner || winner.status !== 'Approved') throw new Error(`Closed listing has no valid winner: ${item.id}`);
    }
    for (const row of rows) {
      const request = row.data();
      if (request.ownerId !== listing.ownerId || request.listingType !== listing.type ||
          !['Pending', 'Approved', 'Canceled', 'Declined', undefined].includes(request.status) ||
          (request.status === undefined && request.requestEpoch !== 0)) {
        throw new Error(`Invalid legacy request ${row.id}; repair before migration.`);
      }
    }
    plans.push({ item, rows, epoch: closed ? 1 : 0 });
  }
  if (apply) {
    for (const { item, rows, epoch } of plans) {
      // Small resumable transactions avoid the 500-write limit. No client can
      // create or decide an Open request until the final ready marker commits.
      for (const row of rows) {
        await db.runTransaction(async tx => {
          const current = await tx.get(row.ref);
          if (!current.exists) throw new Error(`Request disappeared: ${row.id}`);
          const patch = { requestEpoch: 0 };
          if (current.data().status === 'Pending') patch.status = FieldValue.delete();
          tx.update(row.ref, patch);
        });
      }
      await item.ref.update({ requestSchemaVersion: 2, approvalEpoch: epoch });
    }
  }
  return { listings: plans.length, requests: plans.reduce((sum, plan) => sum + plan.rows.length, 0), applied: apply };
}
