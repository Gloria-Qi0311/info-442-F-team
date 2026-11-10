import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getListing, isPastAvailability } from '../data/listings';
import { pickupAreaName } from '../data/listingOptions';
import { usePickupAreas } from '../data/pickupAreas';
import { LISTING_STATUS, LISTING_TYPES } from '../data/schema';
import './ItemDetails.css';

const TYPE_TEXT = {
  [LISTING_TYPES.lend]: { label: 'Borrow', owner: 'Lender', heading: 'Borrowing details' },
  [LISTING_TYPES.sell]: { label: 'Buy', owner: 'Seller', heading: 'Item for sale' },
  [LISTING_TYPES.give]: { label: 'Free', owner: 'Giver', heading: 'Free item' },
};

function Photo({ url, title }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) {
    return <div className="item-details-no-photo" role="img" aria-label="No item photo available">No photo available</div>;
  }
  return <img className="item-details-photo" src={url} alt={title || 'Item photo'} onError={() => setFailed(true)} />;
}

function Detail({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="item-details-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function displayDate(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toLocaleDateString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  }
  return String(value);
}

export default function ItemDetails() {
  const { listingId } = useParams();
  const pickupAreas = usePickupAreas();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setListing(null);
    getListing(listingId)
      .then((result) => {
        if (!active) return;
        if (!result) setError('This item could not be found.');
        else setListing(result);
      })
      .catch((cause) => {
        console.error('Could not load item details:', cause);
        if (active) setError('Could not load this item. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [listingId]);

  const typeText = listing ? TYPE_TEXT[listing.type] : null;
  const available = listing &&
    listing.status === LISTING_STATUS.active &&
    !isPastAvailability(listing);

  return (
    <main className="page item-details">
      <Link className="item-details-back" to="/map">Back to map</Link>
      {loading ? (
        <p role="status">Loading item details...</p>
      ) : error ? (
        <p role="alert" className="error">{error}</p>
      ) : !typeText ? (
        <p role="alert" className="error">This item has an unknown listing type.</p>
      ) : (
        <>
          <p className={`item-details-type item-details-type-${listing.type}`}>{typeText.label}</p>
          <h1>{listing.title || listing.itemName || 'Untitled item'}</h1>
          <Photo url={listing.photoUrl} title={listing.title || listing.itemName} />
          {!available && (
            <p className="item-details-unavailable" role="status">
              This item is no longer available.
            </p>
          )}
          <h2>{typeText.heading}</h2>
          <dl className="item-details-fields">
            <Detail label="Status" value={available ? 'Available' : 'Unavailable'} />
            {listing.type === LISTING_TYPES.sell && listing.price != null && (
              <Detail label="Price" value={`$${Number(listing.price).toFixed(2)}`} />
            )}
            {listing.type === LISTING_TYPES.give && <Detail label="Price" value="Free" />}
            <Detail label="Category" value={listing.category} />
            <Detail label="Condition" value={listing.condition} />
            <Detail label={typeText.owner} value={listing.ownerName} />
            <Detail label="Pickup area" value={listing.pickupAreaId ? pickupAreaName(listing.pickupAreaId, pickupAreas) : ''} />
            <Detail label="Available from" value={displayDate(listing.availableFrom)} />
            <Detail label="Available until" value={displayDate(listing.availableUntil)} />
            <Detail label="Available time slot" value={listing.timeSlot} />
          </dl>
          {listing.description && (
            <section className="item-details-description">
              <h2>Description</h2>
              <p>{listing.description}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
