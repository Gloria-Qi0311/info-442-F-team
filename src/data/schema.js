// Firestore collections and fields, based on the
// "Husky Share – Logical Data Model" (User, Pickup Area, Listing, Request,
// Confirmation Photo, Rating, Points Record).
// Use these constants instead of typing collection names / statuses by hand.

export const COLLECTIONS = {
  users: 'users',
  pickupAreas: 'pickupAreas',
  listings: 'listings',
  requests: 'requests',
  confirmationPhotos: 'confirmationPhotos',
  ratings: 'ratings',
  pointsRecords: 'pointsRecords',
  healthChecks: 'healthChecks',
};

export const LISTING_TYPES = { lend: 'lend', sell: 'sell', give: 'give' };

export const LISTING_STATUS = {
  active: 'Active',
  unavailable: 'Unavailable', // has an approved request in progress
  inactive: 'Inactive', // availability window expired
};

export const REQUEST_STATUS = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

// Lending timeline: Approved → Pickup → Return → Received.
// Selling / giving stop at Pickup.
export const TRANSACTION_STAGE = {
  approved: 'Approved',
  pickup: 'Pickup',
  return: 'Return',
  received: 'Received',
};

export const PHOTO_KINDS = { pickup: 'pickup', return: 'return' };

/*
Document shapes (doc id in brackets):

users/{uid}
  name, uwEmail, totalPoints (number), ratingSum, ratingCount, createdAt

pickupAreas/{areaId}
  name, lat, lng

listings/{listingId}
  ownerId, ownerName, type (lend|sell|give), title, description, category, condition,
  photoUrl, price (sell only), pickupAreaId, availableFrom, availableUntil
  (YYYY-MM-DD), timeSlot, status, createdAt

requests/{requestId}
  listingId, listingType, ownerId, requesterId, status, stage,
  startDate, endDate (lend only), purpose, pickupPreference,
  pickupDate, pickupTime, pickupLocation, createdAt

confirmationPhotos/{photoId}
  requestId, userId, kind (pickup|return), photoUrl, createdAt

ratings/{ratingId}
  requestId, raterId, rateeId, stars (1–5), tags (array), createdAt

pointsRecords/{requestId}      ← doc id = request id, so points can't be added twice
  userId, points, reason, createdAt
*/
