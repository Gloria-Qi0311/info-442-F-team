import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getListing } from '../data/listings';
import { getRequestsForListing, markRequestsViewed, watchRequestsForListing } from '../data/requests';
import { LISTING_TYPES, REQUEST_STATUS } from '../data/schema';
import { decideItemRequest, reconcilePendingRequests } from '../data/requestDecisions';
import { getRequesterRatingSummary } from '../data/requestRatings';
import './ItemDetails.css';
import { userMessage } from '../data/saveWithTimeout';

// Issue #14: sellers (S3) and givers (G3) see the requests for one of their listings.
// Approving and declining requests is added in Issue #16.

const OWNER_ROLE = {
  [LISTING_TYPES.lend]: 'lender',
  [LISTING_TYPES.sell]: 'seller',
  [LISTING_TYPES.give]: 'giver',
};
const ONGOING_TEXT = {
  [LISTING_TYPES.lend]: 'View Ongoing Borrowing',
  [LISTING_TYPES.sell]: 'View Ongoing Purchase',
  [LISTING_TYPES.give]: 'View Ongoing Giveaway',
};

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [approvingId, setApprovingId] = useState('');
  const [pickupByRequest, setPickupByRequest] = useState({});
  const [actionError, setActionError] = useState('');
  const [ratings, setRatings] = useState({});

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    async function load() {
      setLoading(true);
      setError('');
      setListing(null);
      setRequests([]);
      try {
        const result = await getListing(listingId);
        if (!active) return;
        if (!result || result.ownerId !== user.uid || result.type !== type) {
          setError('This listing could not be found in your listings.');
          return;
        }
        setListing(result);

        await reconcilePendingRequests(listingId, user.uid);
        if (!active) return;
        unsubscribe = watchRequestsForListing(listingId, user.uid, async received => {
          if (!active) return;
          setRequests(received);
          setLoading(false);
          const visible = received.filter(request => [REQUEST_STATUS.pending, REQUEST_STATUS.approved].includes(request.status));
          const borrowerIds = [...new Set(visible.map(request => request.requesterId))];
          const summaries = await Promise.all(borrowerIds.map(async id => {
            try { return [id, await getRequesterRatingSummary(id)]; }
            catch (cause) { console.error('Could not load borrower rating:', cause); return [id, null]; }
          }));
          if (active) setRatings(Object.fromEntries(summaries));
          // H4: opening a listing's request page views all of its requests,
          // including ones canceled before the owner saw them (B4.7/S5.17/G6.18
          // keep those off this page, but they must stop counting as unviewed).
          markRequestsViewed(received);
        }, () => {
          if (active) {
            setError('Could not load requests. Please try again.');
            setLoading(false);
          }
        });
      } catch (cause) {
        console.error('Could not load requests:', cause);
        if (active) setError('Could not load requests. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (user) load();
    return () => { active = false; unsubscribe(); };
  }, [listingId, user, type]);

  async function decide(request, decision) {
    setBusyId(request.id);
    setActionError('');
    try {
      await decideItemRequest(request.id, user.uid, decision, pickupByRequest[request.id] || {});
      if (decision === 'approve') await reconcilePendingRequests(listingId, user.uid);
      setRequests(await getRequestsForListing(listingId, user.uid));
      setApprovingId('');
      if (decision === 'approve' && OWNER_ROLE[type]) {
        navigate(`/transactions/${OWNER_ROLE[type]}/${request.id}`);
      }
    } catch (cause) {
      setActionError(userMessage(cause, 'Could not update this request. Check your connection and try again.'));
    } finally {
      setBusyId('');
    }
  }

  const pageText = PAGE_TEXT[type] || (type === LISTING_TYPES.lend
    ? { heading: 'Borrowing requests', requester: 'Borrower' }
    : null);
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

      {actionError && <p role="alert" className="error">{actionError}</p>}
      {loading ? (
        <p role="status">Loading requests...</p>
      ) : error ? (
        <p role="alert" className="error">{error}</p>
      ) : !requests.some(request => request.status === REQUEST_STATUS.pending) ? (
        <>
          <p role="status">No pending requests</p>
          {OWNER_ROLE[type] && requests.filter(request => request.status === REQUEST_STATUS.approved).map(request => (
            <p key={request.id}><Link to={`/transactions/${OWNER_ROLE[type]}/${request.id}`}>{ONGOING_TEXT[type]}: {request.listingTitle || 'Item'}</Link></p>
          ))}
        </>
      ) : requests.length === 0 ? (
        <p role="status">No pending requests</p>
      ) : (
        <ul className="item-details-fields listing-requests">
          {requests.filter(request => request.status === REQUEST_STATUS.pending || request.status === REQUEST_STATUS.approved).map((request) => (
            <li key={request.id} className="item-details-field">
              <div>
                <strong>{pageText.requester}:</strong> {request.requesterName || 'UW Student'}
                {sentDate(request.createdAt) && (
                  <div className="listing-request-date">Sent {sentDate(request.createdAt)}</div>
                )}
              </div>
              <div>
                  <strong>{pageText.requester} rating:</strong>{' '}
                  {ratings[request.requesterId]?.average != null
                    ? `${ratings[request.requesterId].average} / 5 stars`
                    : 'No ratings yet'}
                  {Boolean(ratings[request.requesterId]?.topTags?.length) && (
                    <p><strong>Most received tags:</strong>{' '}
                      {ratings[request.requesterId].topTags.join(', ')}
                    </p>
                  )}
                </div>
              <div>
                <span className={`request-status request-status-${String(request.status).toLowerCase()}`}>
                  {request.status}
                </span>
              </div>
              {request.startDate && <p>Borrow: {request.startDate} to {request.endDate}</p>}
              {request.pickupPreference && <p>Pickup preference: {request.pickupPreference}</p>}
              {request.purpose && <p>Purpose: {request.purpose}</p>}
              {OWNER_ROLE[type] && request.status === REQUEST_STATUS.approved && (
                <p><Link to={`/transactions/${OWNER_ROLE[type]}/${request.id}`}>{ONGOING_TEXT[type]}</Link></p>
              )}
              {request.status === REQUEST_STATUS.approved && request.pickupLocation && (
                <p>Pickup: {request.pickupDate} at {request.pickupTime}, {request.pickupLocation}</p>
              )}
              {request.status === REQUEST_STATUS.pending && (
                <div className="request-decision">
                  {approvingId === request.id && (
                    <div>
                      <label>Pickup date <input type="date"
                        min={new Date().toLocaleDateString('sv-SE')}
                        value={pickupByRequest[request.id]?.date || ''}
                        onChange={e => setPickupByRequest(prev => ({ ...prev, [request.id]: { ...prev[request.id], date: e.target.value } }))} /></label>
                      <label>Pickup time <input type="time"
                        value={pickupByRequest[request.id]?.time || ''}
                        onChange={e => setPickupByRequest(prev => ({ ...prev, [request.id]: { ...prev[request.id], time: e.target.value } }))} /></label>
                      <label>Pickup location <input type="text"
                        value={pickupByRequest[request.id]?.location || ''}
                        onChange={e => setPickupByRequest(prev => ({ ...prev, [request.id]: { ...prev[request.id], location: e.target.value } }))} /></label>
                      <button type="button" disabled={Boolean(busyId)}
                        onClick={() => decide(request, 'approve')}>Confirm approval</button>
                      <button type="button" disabled={Boolean(busyId)}
                        onClick={() => setApprovingId('')}>Back</button>
                    </div>
                  )}
                  {approvingId !== request.id && (
                    <button type="button" disabled={Boolean(busyId)}
                      onClick={() => { setActionError(''); setApprovingId(request.id); }}>{type === LISTING_TYPES.sell ? 'Accept' : 'Approve'}</button>
                  )}
                  <button type="button" disabled={Boolean(busyId)}
                    onClick={() => decide(request, 'decline')}>Decline</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
