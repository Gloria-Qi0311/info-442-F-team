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

export const PICKUP_AREAS = [
  { id: 'red-square', name: 'Red Square' },
  { id: 'hub', name: 'HUB' },
  { id: 'suzzallo', name: 'Suzzallo Library' },
  { id: 'odegaard', name: 'Odegaard Library' },
  { id: 'ima', name: 'IMA' },
  { id: 'west-campus', name: 'West Campus' },
  { id: 'north-campus', name: 'North Campus' },
  { id: 'the-ave', name: 'The Ave' },
];

export const TIME_SLOTS = [
  'Morning (8am–12pm)',
  'Afternoon (12pm–5pm)',
  'Evening (5pm–9pm)',
];

export function pickupAreaName(id) {
  return PICKUP_AREAS.find((area) => area.id === id)?.name || id;
}
