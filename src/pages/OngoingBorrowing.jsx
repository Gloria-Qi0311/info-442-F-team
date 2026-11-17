import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_TYPES, PHOTO_KINDS, REQUEST_STATUS, TRANSACTION_STAGE } from '../data/schema';
import { confirmExchange, confirmationId, isParticipant, STAGES } from '../data/transactionProgress';
import './ItemDetails.css';

export default function OngoingBorrowing() {
  const { requestId, role, action } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [myPickupConfirmed, setMyPickupConfirmed] = useState(false);
  const isOwner = role === 'lender';
  const validRole = role === 'lender' || role === 'borrower';
  const validAction = !action || action === 'pickup' || action === 'return';

  useEffect(() => {
    if (!user || !requestId) return undefined;
    return onSnapshot(doc(db, COLLECTIONS.requests, requestId), snap => {
      setRequest(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }, () => {
      setError('Could not load the transaction. Please try again.');
      setLoading(false);
    });
  }, [requestId, user]);

  useEffect(() => {
    if (!user || !requestId) return undefined;
    return onSnapshot(doc(db, COLLECTIONS.confirmationPhotos, confirmationId(requestId, PHOTO_KINDS.pickup, user.uid)), snap => {
      setMyPickupConfirmed(snap.exists());
    }, () => setMyPickupConfirmed(false));
  }, [requestId, user]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const permitted = validRole && validAction && request
    && request.listingType === LISTING_TYPES.lend
    && request.status === REQUEST_STATUS.approved
    && isParticipant(request, user?.uid)
    && (isOwner ? request.ownerId === user?.uid : request.requesterId === user?.uid);
  const stage = request?.stage || TRANSACTION_STAGE.approved;
  const base = `/transactions/${role}/${requestId}`;
  const expected = action === PHOTO_KINDS.pickup ? TRANSACTION_STAGE.approved
    : isOwner ? TRANSACTION_STAGE.return : TRANSACTION_STAGE.pickup;

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await confirmExchange(requestId, user.uid, action, photo);
      navigate(action === 'return' && isOwner ? `${base}/complete` : base, { replace: true });
    } catch (cause) {
      setError(cause.message || 'Could not confirm. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page item-details">
      <Link to="/manage">Back to Manage</Link>
      <h1>{action === 'pickup' ? 'Pickup Confirmation' : action === 'return' ? 'Return Confirmation' : 'Ongoing Borrowing'}</h1>
      {loading ? <p role="status">Loading transaction...</p> : !permitted ? (
        <p role="alert">This transaction is not available to your account.</p>
      ) : (
        <>
          <h2>{request.listingTitle || 'Borrowed item'}</h2>
          <section className="item-request">
            <h3>Ready for pick up</h3>
            <p><strong>Pickup day:</strong> {request.pickupDate || 'Not set'}</p>
            <p><strong>Pickup time:</strong> {request.pickupTime || 'Not set'}</p>
            <p><strong>Pickup location:</strong> {request.pickupLocation || 'Not set'}</p>
          </section>
          <h3>Transaction progress</h3>
          <ol aria-label="Transaction timeline">
            {STAGES.map((step, index) => (
              <li key={step} aria-current={step === stage ? 'step' : undefined}>
                {step}{STAGES.indexOf(stage) > index ? ' ✓' : step === stage ? ' — Current' : ''}
              </li>
            ))}
          </ol>
          {action ? (
            action === PHOTO_KINDS.pickup && myPickupConfirmed ? (
              <p>Your pickup is confirmed. Waiting for the other person to confirm.</p>
            ) : stage === expected ? (
              <section className="item-request">
                <label htmlFor="confirmation-photo">Photo of the item</label>
                <input id="confirmation-photo" type="file" accept="image/*" onChange={event => {
                  const file = event.target.files?.[0] || null;
                  setPhoto(file);
                  setPreview(file ? URL.createObjectURL(file) : '');
                }} />
                {preview && <img src={preview} alt="Confirmation preview" style={{ maxWidth: 240 }} />}
                <button type="button" disabled={busy} onClick={confirm}>
                  {busy ? 'Saving...' : action === 'pickup' ? 'Pick up confirmed' : 'Return confirmed'}
                </button>
              </section>
            ) : <p>This confirmation is not available at the current stage.</p>
          ) : (
            <>
              {stage === TRANSACTION_STAGE.approved && (
                myPickupConfirmed ? <p>Pickup confirmed. Waiting for the other person.</p>
                  : <Link to={`${base}/pickup`}>Mark as picked up</Link>
              )}
              {stage === TRANSACTION_STAGE.pickup && (
                <>
                  <p><strong>Return due date:</strong> {request.endDate || 'Not set'}</p>
                  {!isOwner && <p><Link to={`${base}/return`}>Mark as returned</Link></p>}
                </>
              )}
              {stage === TRANSACTION_STAGE.return && isOwner && (
                <Link to={`${base}/return`}>Confirm return</Link>
              )}
              {stage === TRANSACTION_STAGE.return && !isOwner && <p>Waiting for the lender to confirm the return.</p>}
              {stage === TRANSACTION_STAGE.received && (
                <p>Return completed. <Link to={`${base}/complete`}>Rate {isOwner ? 'borrower' : 'lender'}</Link></p>
              )}
            </>
          )}
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  );
}
