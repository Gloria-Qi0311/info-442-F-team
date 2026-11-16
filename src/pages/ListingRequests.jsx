import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getListing } from '../data/listings';
import { getRequestsForListing, markRequestsViewed } from '../data/requests';
import { LISTING_TYPES } from '../data/schema';
import './ItemDetails.css';

// Issue #14: sellers (S3) and givers (G3) see the requests for one of their listings.
// Approving and declining requests is added in Issue #16.

const PAGE_TEXT = {
  [LISTING_TYPES.sell]: { heading: 'Purchase requests', requester: 'Buyer' },
  [LISTING_TYPES.give]: { heading: 'Giveaway requests', requester: 'Recipient' },
};

function sentDate(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toLocaleString();
  return '';
}

export default function ListingRequests() {
  const { type, listingId } = useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      setListing(null);
      setRequests([]);
      try {
        const result = await getListing(listingId);
        if (!active) return;
        if (!result || result.ownerId !== user.uid) {
          setError('This listing could not be found in your listings.');
          return;
        }
        setListing(result);

        const received = await getRequestsForListing(listingId, user.uid);
        if (!active) return;
        setRequests(received);
        markRequestsViewed(received);
      } catch (cause) {
        console.error('Could not load requests:', cause);
        if (active) setError('Could not load requests. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (user) load();
    return () => { active = false; };
  }, [listingId, user]);

  const pageText = PAGE_TEXT[type];
  if (!pageText) {
    return (
      <main className="page">
        <p>Requests are not available for this listing type.</p>
        <Link to="/manage">Back to Manage</Link>
      </main>
    );
  }

  return (
    <main className="page item-details">
      <Link className="item-details-back" to={`/manage/${type}`}>Back to my listings</Link>
      <h1>{pageText.heading}</h1>
      {listing && <p>{listing.title || listing.itemName || 'Untitled item'}</p>}

      {loading ? (
        <p role="status">Loading requests...</p>
      ) : error ? (
        <p role="alert" className="error">{error}</p>
      ) : requests.length === 0 ? (
        <p role="status">No requests for this item yet.</p>
      ) : (
        <ul className="item-details-fields listing-requests">
          {requests.map((request) => (
            <li key={request.id} className="item-details-field">
              <div>
                <strong>{pageText.requester}:</strong> {request.requesterName || 'UW Student'}
                {sentDate(request.createdAt) && (
                  <div className="listing-request-date">Sent {sentDate(request.createdAt)}</div>
                )}
              </div>
              <div>
                <span className={`request-status request-status-${String(request.status).toLowerCase()}`}>
                  {request.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
