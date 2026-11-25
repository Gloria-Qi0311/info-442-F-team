import { db } from '../firebase';
import { decideItemRequestInDatabase } from './requestDecisionsCore.js';

export function decideItemRequest(requestId, ownerId, decision, pickup) {
  return decideItemRequestInDatabase(db, requestId, ownerId, decision, pickup);
}

// Existing callers can keep this hook; epoch decisions need no eventual repair.
export async function reconcilePendingRequests() { return 0; }
