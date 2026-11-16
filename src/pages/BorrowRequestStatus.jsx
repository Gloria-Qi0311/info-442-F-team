import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getBorrowRequest } from '../data/borrowRequests';
import { cancelItemRequest } from '../data/requests';
import { REQUEST_STATUS } from '../data/schema';
import './ItemDetails.css';

export default function BorrowRequestStatus() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getBorrowRequest(listingId, user.uid)
      .then(value => { if (active) setRequest(value); })
      .catch(() => { if (active) setError('Could not load request.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId, user]);

  async function cancel() {
    if (!window.confirm('Cancel this borrowing request?')) return;
    setBusy(true);
    setError('');
    try {
      setRequest(await cancelItemRequest(request.id, user.uid));
    } catch (cause) {
      setError(cause.message || 'Could not cancel request.');
    } finally {
      setBusy(false);
    }
  }

  const status = request?.status;
  return (
    <main className="page item-details">
      <Link to={`/listings/${listingId}`}>Back to item</Link>
      <h1>My borrowing request</h1>
      {loading ? <p role="status">Loading...</p> : !request ? (
        <p>No borrowing request found. <Link to={`/listings/${listingId}/borrow`}>Send a request</Link></p>
      ) : (
        <section className="item-request">
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Borrowing dates:</strong> {request.startDate} to {request.endDate}</p>
          <p><strong>Pickup preference:</strong> {request.pickupPreference}</p>
          <p><strong>Purpose:</strong> {request.purpose}</p>
          {status === REQUEST_STATUS.pending && (
            <>
              <p>Waiting for the item owner to respond.</p>
              <button type="button" disabled={busy} onClick={cancel}>
                {busy ? 'Canceling...' : 'Cancel request'}
              </button>
            </>
          )}
          {status === REQUEST_STATUS.approved && (
            <>
              <p>Your request was approved!</p>
              {request.pickupDate && <p><strong>Pickup date:</strong> {request.pickupDate}</p>}
              {request.pickupTime && <p><strong>Pickup time:</strong> {request.pickupTime}</p>}
              {request.pickupLocation && <p><strong>Pickup location:</strong> {request.pickupLocation}</p>}
            </>
          )}
          {status === REQUEST_STATUS.declined && <p>The item owner declined your request.</p>}
          {status === REQUEST_STATUS.cancelled && <p>You canceled this request.</p>}
        </section>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  );
}
