import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getListing, isPastAvailability } from '../data/listings';
import { pickupAreaName } from '../data/listingOptions';
import { usePickupAreas } from '../data/pickupAreas';
import { cancelItemRequest, getMyRequest, sendItemRequest } from '../data/requests';
import { LISTING_STATUS, LISTING_TYPES, REQUEST_STATUS } from '../data/schema';
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

// Issue #14: "I want it" for Sell (S5) and Give (G6) listings.
// The requester can send a request, see its status, and cancel it while it is Pending.
// The owner sees a link to the requests for their listing instead (S3 / G3).
function RequestPanel({ listing, available }) {
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isOwner = Boolean(user) && listing.ownerId === user.uid;

  useEffect(() => {
    let active = true;
    setRequest(null);
    setError('');
    if (!user || isOwner) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    getMyRequest(listing.id, user.uid)
      .then((result) => {
        if (active) setRequest(result);
      })
      .catch((cause) => {
        console.error('Could not load your request:', cause);
        if (active) setError('Could not load your request status. Please refresh the page.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [listing.id, user, isOwner]);

  async function handleSend() {
    setBusy(true);
    setError('');
    try {
      setRequest(await sendItemRequest(listing.id, user));
    } catch (cause) {
      console.error('Could not send request:', cause);
      // Firebase errors (such as "Connection failed.") get a clear message instead.
      setError(cause.code || !cause.message
        ? 'Your request could not be sent. Check your connection and try again.'
        : cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancel your request for this item?')) return;
    setBusy(true);
    setError('');
    try {
      setRequest(await cancelItemRequest(request.id, user.uid));
    } catch (cause) {
      console.error('Could not cancel request:', cause);
      setError(cause.message || 'Could not cancel your request. Please try again.');
    } finally {
      setBusy(false);
    }
  }



  if (isOwner) {
    return (
      <section className="item-request">
        <p>This is your listing.</p>
        <Link className="item-request-link" to={`/manage/${listing.type}/${listing.id}/requests`}>
          View requests for this item
        </Link>
      </section>
    );
  }

  if (listing.type === LISTING_TYPES.lend) {
    if (isOwner) {
      return <section className="item-request"><p>This is your listing.</p><Link to={`/manage/lend/${listing.id}/requests`}>View requests for this item</Link></section>;
    }
    if (loading) return <p role="status">Loading your request...</p>;
    const hasRequest = Boolean(request);
    return (
      <section className="item-request">
        {hasRequest && <p>Your request: {request.status}</p>}
        {hasRequest && <Link to={`/listings/${listing.id}/borrow/status`}>View my borrowing request</Link>}
        {available && (!hasRequest || request.status === REQUEST_STATUS.cancelled) && (
          <Link className="item-request-link" to={`/listings/${listing.id}/borrow`}>Send request!</Link>
        )}
        {error && <p role="alert" className="error">{error}</p>}
      </section>
    );
  }

  if (loading) {
    return <p role="status">Loading your request...</p>;
  }

  const status = request ? request.status : null;
  const canSend = available && (!status || status === REQUEST_STATUS.cancelled);

  return (
    <section className="item-request">
      {status && (
        <p>
          <strong>Your request:</strong>{' '}
          <span className={`request-status request-status-${status.toLowerCase()}`}>{status}</span>
        </p>
      )}
      {status === REQUEST_STATUS.pending && (
        <>
          <p>Your request has been sent. The owner will approve or decline it.</p>
          <button type="button" className="item-request-cancel" onClick={handleCancel} disabled={busy}>
            {busy ? 'Canceling...' : 'Cancel request'}
          </button>
        </>
      )}
      {status === REQUEST_STATUS.approved && (
        <div>
          <p>Your request was approved!</p>
          {request.pickupDate && <p>Pickup date: {request.pickupDate}</p>}
          {request.pickupTime && <p>Pickup time: {request.pickupTime}</p>}
          {request.pickupLocation && <p>Pickup location: {request.pickupLocation}</p>}
          <p>
            <Link to={`/transactions/${listing.type === LISTING_TYPES.sell ? 'buyer' : 'recipient'}/${request.id}`}>
              {listing.type === LISTING_TYPES.sell ? 'View Ongoing Purchase' : 'View Ongoing Giveaway'}
            </Link>
          </p>
        </div>
      )}
      {status === REQUEST_STATUS.declined && (
        <p>The owner declined your request for this item.</p>
      )}
      {canSend && (
        <button type="button" className="item-request-send" onClick={handleSend} disabled={busy}>
          {busy ? 'Sending...' : 'I want it'}
        </button>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
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
          <RequestPanel listing={listing} available={available} />
        </>
      )}
    </main>
  );
}
