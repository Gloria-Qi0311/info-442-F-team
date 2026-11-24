// Availability dates are campus calendar dates, independent of the visitor's timezone.
export function seattleDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function isPastAvailability(listing, now = new Date()) {
  const end = listing.availableUntil;
  if (typeof end !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const parsed = new Date(end + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== end) return false;
  return end < seattleDate(now);
}
