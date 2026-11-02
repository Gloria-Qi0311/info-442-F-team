import { addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from './schema.js';

// Save one test document and read it back. Used to verify Issue 1.1.
export async function runHealthCheck(db, message) {
  const ref = await addDoc(collection(db, COLLECTIONS.healthChecks), {
    message,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Saved document could not be read back.');
  }
  return { id: ref.id, data: snap.data() };
}
