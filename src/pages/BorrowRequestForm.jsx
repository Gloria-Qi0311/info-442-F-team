import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getListing } from '../data/listings';
import { getBorrowRequest, sendBorrowRequest } from '../data/borrowRequests';
import { REQUEST_STATUS, LISTING_TYPES, LISTING_STATUS } from '../data/schema';
import './ItemDetails.css';

export default function BorrowRequestForm() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [values, setValues] = useState({ startDate: '', endDate: '', pickupPreference: '', purpose: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getListing(listingId), getBorrowRequest(listingId, user.uid)])
      .then(([item, existing]) => {
        if (!active) return;
        if (!item || item.type !== LISTING_TYPES.lend || item.ownerId === user.uid) {
          setError('This item cannot be requested.');
        } else if (item.status !== LISTING_STATUS.active) {
          setError('This item is no longer available.');
        } else if (existing && [REQUEST_STATUS.pending, REQUEST_STATUS.approved].includes(existing.status)) {
          navigate(`/listings/${listingId}/borrow/status`, { replace: true });
        } else if (existing?.status === REQUEST_STATUS.declined) {
          setError('The owner has declined your previous request for this item.');
        } else {
          setListing(item);
        }
      })
      .catch(() => { if (active) setError('Could not load the borrowing form.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId, user, navigate]);

  function change(field, value) {
    setValues(current => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await sendBorrowRequest(listingId, user, values);
      navigate(`/listings/${listingId}/borrow/status`, { replace: true });
    } catch (cause) {
      setError(cause.message || 'Could not send request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page item-details">
      <Link to={`/listings/${listingId}`}>Back to item</Link>
      <h1>Borrow request</h1>
      {loading ? <p role="status">Loading...</p> : listing ? (
        <>
          <p>{listing.title || listing.itemName || 'Item'}</p>
          <p>Available: {listing.availableFrom} to {listing.availableUntil}</p>
          <form onSubmit={submit} noValidate className="borrow-form">
            <label htmlFor="borrow-start">Start date</label>
            <input id="borrow-start" type="date" required min={listing.availableFrom} max={listing.availableUntil}
              value={values.startDate} onChange={event => change('startDate', event.target.value)} />
            <label htmlFor="borrow-end">Return date</label>
            <input id="borrow-end" type="date" required min={values.startDate || listing.availableFrom}
              max={listing.availableUntil} value={values.endDate} onChange={event => change('endDate', event.target.value)} />
            <label htmlFor="borrow-pickup">Pickup preference</label>
            <textarea id="borrow-pickup" required value={values.pickupPreference}
              onChange={event => change('pickupPreference', event.target.value)} />
            <label htmlFor="borrow-purpose">Purpose of use</label>
            <textarea id="borrow-purpose" required value={values.purpose}
              onChange={event => change('purpose', event.target.value)} />
            <button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send my request'}</button>
          </form>
        </>
      ) : null}
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  );
}
