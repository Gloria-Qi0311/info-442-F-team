import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './schema';

// R8/R10/R13: aggregate existing ratings received by a requester.
export async function getRequesterRatingSummary(requesterId) {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.ratings),
    where('rateeId', '==', requesterId)));
  let total = 0;
  let count = 0;
  const tags = new Map();
  for (const entry of snapshot.docs) {
    const rating = entry.data();
    if (Number.isInteger(rating.stars) && rating.stars >= 1 && rating.stars <= 5) {
      total += rating.stars;
      count += 1;
    }
    if (Array.isArray(rating.tags)) {
      for (const tag of rating.tags) {
        if (typeof tag === 'string' && tag.trim()) {
          const label = tag.trim();
          tags.set(label, (tags.get(label) || 0) + 1);
        }
      }
    }
  }
  const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([tag]) => tag);
  return {
    average: count ? Math.round(total / count) : null,
    count,
    topTags,
  };
}
