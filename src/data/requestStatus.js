// Request status v2: terminal decisions live on the request. An undecided
// request belongs to a listing approval epoch. Advancing that epoch atomically
// declines EVERY undecided request from earlier epochs, without a fan-out write.
// This is the persisted data model, also enforced by Firestore Rules; never
// store a second, potentially stale `status: Pending` alongside it.
export function requestStatus(request, listing) {
  if (request.status) return request.status; // terminal decisions / legacy reads
  if (!Number.isSafeInteger(request.requestEpoch) || request.requestEpoch < 0 || !Number.isSafeInteger(listing?.approvalEpoch) || listing.approvalEpoch < 0) {
    throw new Error('Request data needs migration. Please try again later.');
  }
  if (request.requestEpoch > listing.approvalEpoch) throw new Error('Invalid request epoch.');
  return request.requestEpoch === listing.approvalEpoch ? 'Pending' : 'Declined';
}

export function withRequestStatus(request, listing) {
  return { ...request, status: requestStatus(request, listing) };
}

export function requireRequestSchema(listing) {
  if (listing.requestSchemaVersion !== 2 || !Number.isSafeInteger(listing.approvalEpoch) || listing.approvalEpoch < 0) {
    throw new Error('This item is being updated. Please try again later.');
  }
}
