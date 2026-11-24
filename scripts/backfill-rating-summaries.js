import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Run with rating writes paused before the first rollout. Dry-run is the default.
const projectId = process.env.GCLOUD_PROJECT;
if (!projectId) throw new Error('GCLOUD_PROJECT is required.');
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const ratings = await db.collection('ratings').get();
const users = new Set(ratings.docs.map(item => item.data().rateeId));
let summaries = 0;
for (const uid of users) {
  if (typeof uid !== 'string' || !uid) throw new Error('Invalid legacy rateeId; manual repair required.');
  await db.runTransaction(async tx => {
    const entries = await tx.get(db.collection('ratings').where('rateeId', '==', uid));
    let total = 0;
    for (const entry of entries.docs) {
      const stars = entry.data().stars;
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('Invalid legacy stars; manual repair required.');
      total += stars;
    }
    if (process.argv.includes('--apply')) tx.set(db.doc('ratingSummaries/' + uid), {
      ratingTotal: total, ratingCount: entries.size,
      overallRating: Math.round(total / entries.size), lastRatingId: entries.docs.at(-1).id,
    });
  });
  summaries++;
}
console.log(`${process.argv.includes('--apply') ? 'Updated' : 'Would update'} ${summaries} rating summaries.`);
