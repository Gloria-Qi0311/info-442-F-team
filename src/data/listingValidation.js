// Validation for the Lend, Sell, and Give forms
// (L1.9–L1.11, S1.10–S1.15, G1.10–G1.12).

const FIELD_LABELS = {
  price: 'Price',
  title: 'Item name',
  category: 'Category',
  condition: 'Condition',
  pickupAreaId: 'Pickup area',
  availableFrom: 'Available start date',
  availableUntil: 'Available end date',
  timeSlot: 'Available time slot',
  photo: 'Photo',
};

// Today's date as YYYY-MM-DD in the user's local time zone.
export function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Returns an object of { fieldName: errorMessage }. Empty object means valid.
export function validateListing(values, type) {
  const errors = {};
  const fields = Object.keys(FIELD_LABELS);
  const required = type === 'sell' ? fields : fields.filter((key) => key !== 'price');

  required.forEach((field) => {
    const value = values[field];
    const empty = field === 'photo' ? !value : !String(value ?? '').trim();
    if (empty) {
      errors[field] = `${FIELD_LABELS[field]} is required.`;
    }
  });

  if (type === 'sell' && !errors.price) {
    const price = String(values.price).trim();
    if (!/^-?\d*\.?\d+$/.test(price)) {
      errors.price = 'Please enter a numeric price.';
    } else if (Number(price) <= 0) {
      errors.price = 'Please enter a price greater than zero.';
    } else if (/\.\d{3,}$/.test(price)) {
      errors.price = 'Please enter a price with at most two decimal places.';
    }
  }

  if (!errors.availableFrom && values.availableFrom < todayString()) {
    errors.availableFrom = 'Please choose a start date that is today or later.';
  }

  if (!errors.availableFrom && !errors.availableUntil
    && values.availableUntil < values.availableFrom) {
    errors.availableUntil = 'Please choose a valid date range. The end date cannot be before the start date.';
  }

  return errors;
}
