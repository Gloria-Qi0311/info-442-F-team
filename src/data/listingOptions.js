// Dropdown options for the Lend, Sell, and Give forms (L1, S1, G1).

export const CATEGORIES = [
  'Textbooks',
  'Electronics',
  'Furniture',
  'Kitchen',
  'Clothing',
  'Sports & Outdoors',
  'School Supplies',
  'Other',
];

export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

// lat/lng place each area's marker on the campus map (Issue 3.1).
export const PICKUP_AREAS = [
  { id: 'red-square', name: 'Red Square', lat: 47.6560, lng: -122.3095 },
  { id: 'hub', name: 'HUB', lat: 47.6553, lng: -122.3051 },
  { id: 'suzzallo', name: 'Suzzallo Library', lat: 47.6557, lng: -122.3083 },
  { id: 'odegaard', name: 'Odegaard Library', lat: 47.6565, lng: -122.3104 },
  { id: 'ima', name: 'IMA', lat: 47.6538, lng: -122.3015 },
  { id: 'west-campus', name: 'West Campus', lat: 47.6567, lng: -122.3157 },
  { id: 'north-campus', name: 'North Campus', lat: 47.6593, lng: -122.3040 },
  { id: 'the-ave', name: 'The Ave', lat: 47.6614, lng: -122.3132 },
];

export const TIME_SLOTS = [
  'Morning (8am–12pm)',
  'Afternoon (12pm–5pm)',
  'Evening (5pm–9pm)',
];

export function pickupAreaName(id, areas = PICKUP_AREAS) {
  return areas.find((area) => area.id === id)?.name || id;
}
