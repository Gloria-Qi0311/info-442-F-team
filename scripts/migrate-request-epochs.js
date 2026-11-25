import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrateRequestEpochs } from './lib/migrate-request-epochs.js';

const projectId = process.env.GCLOUD_PROJECT;
if (!projectId) throw new Error('GCLOUD_PROJECT is required.');
initializeApp({ credential: applicationDefault(), projectId });
const result = await migrateRequestEpochs(getFirestore(), { apply: process.argv.includes('--apply') });
console.log(JSON.stringify(result));
