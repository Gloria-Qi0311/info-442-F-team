// Command-line version of the DB check (Issue 1.1 verification).
// Usage: start emulators (npm run emulators), then: npm run test:db
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';
import { runHealthCheck } from '../src/data/healthCheck.js';

const app = initializeApp({ projectId: 'demo-husky-share', apiKey: 'demo-key' });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

try {
  const result = await runHealthCheck(db, 'CLI test ' + new Date().toISOString());
  console.log('PASS: saved and retrieved', result.id, '-', result.data.message);
  await terminate(db);
  process.exit(0);
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
}
