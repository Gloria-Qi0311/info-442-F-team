// Writes the 8 pickup areas in src/data/listingOptions.js to the Firestore
// pickupAreas collection (same id/name/lat/lng), overwriting existing docs.
// Live project:  GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json npm run seed:pickup-areas
// Emulator:      FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:pickup-areas
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PICKUP_AREAS } from '../src/data/listingOptions.js';

const projectId = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'demo-husky-share';
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

const batch = db.batch();
PICKUP_AREAS.forEach(({ id, name, lat, lng }) => {
  batch.set(db.collection('pickupAreas').doc(id), { name, lat, lng });
});
await batch.commit();
console.log(`Wrote ${PICKUP_AREAS.length} pickup areas to project ${projectId}.`);
