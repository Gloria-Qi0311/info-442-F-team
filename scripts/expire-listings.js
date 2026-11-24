import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { expireListings } from './lib/expire-listings.js';

// Uses the repository's existing deployment identity; never store keys in source.
const projectId = process.env.GCLOUD_PROJECT;
if (!projectId) throw new Error('GCLOUD_PROJECT is required.');
initializeApp({ credential: applicationDefault(), projectId });
console.log(`Expired ${await expireListings(getFirestore())} listings.`);
