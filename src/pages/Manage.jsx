import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMySentRequests } from '../data/requests';
import { LISTING_TYPES } from '../data/schema';
import './ItemDetails.css';
import RequestStatusBadge from '../components/RequestStatusBadge';

const LISTING_LINKS = [
  { to: '/manage/lend', label: 'My lending listings' },
  { to: '/manage/sell', label: 'My selling listings' },
  { to: '/manage/give', label: 'My giveaway listings' },
];

const TYPE_LABELS = {
  [LISTING_TYPES.lend]: 'Borrow',
  [LISTING_TYPES.sell]: 'Buy',
  [LISTING_TYPES.give]: 'Free',
};

function sentDate(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toLocaleDateString();
  return '';
}

// H8–H10: the requests the user has sent, each linking to its request page
// (B4 / S5 / G6 are shown on the item's page).
function SentRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user) return () => { active = false; };
    setLoading(true);
    setError('');
    getMySentRequests(user.uid)
      .then((result) => {
        if (active) setRequests(result);
      })
      .catch((cause) => {
        console.error('Could not load sent requests:', cause);
        if (active) setError('Could not load your requests. Please refresh the page.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  if (loading) return <p role="status">Loading your requests...</p>;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (requests.length === 0) return <p role="status">You have not sent any requests yet.</p>;

  return (
    <ul className="item-details-fields listing-requests">
      {requests.map((request) => (
        <li key={request.id} className="item-details-field">
          <div>
            <Link className="item-request-link" to={request.listingType === LISTING_TYPES.lend ? `/listings/${request.listingId}/borrow/status` : `/listings/${request.listingId}`}>
              {request.listingTitle || 'Untitled item'}
            </Link>
            <div className="listing-request-date">
              {TYPE_LABELS[request.listingType] || 'Request'}
              {sentDate(request.createdAt) && ` · Sent ${sentDate(request.createdAt)}`}
            </div>
          </div>
          <div>
            <RequestStatusBadge status={request.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Manage() {
  return (
    <main className="page">
      <h1>Manage</h1>
      <ul className="link-list">
        {LISTING_LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to}>{link.label}</Link>
          </li>
        ))}
      </ul>
      <h2>My requests</h2>
      <SentRequests />
    </main>
  );
}
