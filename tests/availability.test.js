import { test } from 'node:test';
import { equal } from 'node:assert/strict';
import { isPastAvailability } from '../src/data/availability.js';

test('availability includes the entire Seattle end date, through its final millisecond', () => {
  const listing = { availableUntil: '2026-11-23' };
  equal(isPastAvailability(listing, new Date('2026-11-24T07:59:59.999Z')), false);
  equal(isPastAvailability(listing, new Date('2026-11-24T08:00:00Z')), true);
});

test('Seattle daylight saving boundaries use the actual local date', () => {
  for (const [end, midnight] of [['2026-07-01', '2026-07-02T07:00:00Z'], ['2026-03-08', '2026-03-09T07:00:00Z'], ['2026-11-01', '2026-11-02T08:00:00Z']]) {
    equal(isPastAvailability({ availableUntil: end }, new Date(new Date(midnight).getTime() - 1)), false);
    equal(isPastAvailability({ availableUntil: end }, new Date(midnight)), true);
  }
});

test('missing or malformed dates do not expire a listing', () => {
  for (const availableUntil of [undefined, '', 'bad', '2026-02-30']) {
    equal(isPastAvailability({ availableUntil }, new Date('2027-01-01T00:00:00Z')), false);
  }
});
