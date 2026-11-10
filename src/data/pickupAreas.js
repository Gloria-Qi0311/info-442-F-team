import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './schema.js';
import { PICKUP_AREAS } from './listingOptions.js';

// Pickup areas come from the Firestore pickupAreas collection.
// If it can't be read or has no valid areas, fall back to PICKUP_AREAS.
let cached = null;

export function loadPickupAreas() {
  if (!cached) {
    cached = getDocs(collection(db, COLLECTIONS.pickupAreas))
      .then((snap) => {
        const areas = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => typeof a.name === 'string' && typeof a.lat === 'number' && typeof a.lng === 'number');
        return areas.length ? areas : PICKUP_AREAS;
      })
      .catch((err) => {
        console.error('Could not load pickup areas:', err);
        cached = null;
        return PICKUP_AREAS;
      });
  }
  return cached;
}

export function usePickupAreas() {
  const [areas, setAreas] = useState(PICKUP_AREAS);
  useEffect(() => {
    let active = true;
    loadPickupAreas().then((result) => {
      if (active) setAreas(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return areas;
}
