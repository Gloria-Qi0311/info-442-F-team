import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import TransactionTimeline from '../components/TransactionTimeline';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_TYPES, PHOTO_KINDS, REQUEST_STATUS, TRANSACTION_STAGE } from '../data/schema';
import { confirmExchange, confirmSellGivePickup, confirmationId, isParticipant, STAGES } from '../data/transactionProgress';
import './ItemDetails.css';

// L5/B5 lending, S6 selling, G4 giving.
const ROLES = {
  lender: { type: LISTING_TYPES.lend, owner: true },
  borrower: { type: LISTING_TYPES.lend, owner: false },
  seller: { type: LISTING_TYPES.sell, owner: true },
  buyer: { type: LISTING_TYPES.sell, owner: false },
  giver: { type: LISTING_TYPES.give, owner: true },
  recipient: { type: LISTING_TYPES.give, owner: false },
};
const TITLES = {
  [LISTING_TYPES.lend]: 'Ongoing Borrowing',
  [LISTING_TYPES.sell]: 'Ongoing Purchase',
  [LISTING_TYPES.give]: 'Ongoing Giveaway',
};
const TIMELINES = {
  [LISTING_TYPES.lend]: STAGES,
  [LISTING_TYPES.sell]: [TRANSACTION_STAGE.approved, TRANSACTION_STAGE.pickup],
  [LISTING_TYPES.give]: [TRANSACTION_STAGE.approved, TRANSACTION_STAGE.pickup, TRANSACTION_STAGE.rate],
};

export default function OngoingBorrowing() {
  const { requestId, role, action } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryHint, setRetryHint] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [myPickupConfirmed, setMyPickupConfirmed] = useState(false);
  const [myReturnConfirmed, setMyReturnConfirmed] = useState(false);
  const roleInfo = ROLES[role];
  const isOwner = Boolean(roleInfo?.owner);
  const type = roleInfo?.type;
  const isLend = type === LISTING_TYPES.lend;
  const validRole = Boolean(roleInfo);
  const validAction = !action || action === 'pickup' || (isLend && action === 'return');

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

  useEffect(() => {
    if (!user || !requestId) return undefined;
    return onSnapshot(doc(db, COLLECTIONS.confirmationPhotos, confirmationId(requestId, PHOTO_KINDS.return, user.uid)), snap => {
      setMyReturnConfirmed(snap.exists());
    }, () => setMyReturnConfirmed(false));
  }, [requestId, user]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const permitted = validRole && validAction && request
    && request.listingType === type
    && request.status === REQUEST_STATUS.approved
    && isParticipant(request, user?.uid)
    && (isOwner ? request.ownerId === user?.uid : request.requesterId === user?.uid);
  const stage = request?.stage || TRANSACTION_STAGE.approved;
  const timeline = TIMELINES[type] || STAGES;
  const base = `/transactions/${role}/${requestId}`;
  // Sell: the buyer confirms pickup. Give: the giver confirms pickup.
  const canMarkPickup = type === LISTING_TYPES.sell ? !isOwner : isOwner;
  const expected = action === PHOTO_KINDS.pickup ? TRANSACTION_STAGE.approved
    : isOwner ? TRANSACTION_STAGE.return : TRANSACTION_STAGE.pickup;

  // G4.10 / S6.8 / L6.6 / B6.6 / L7.6 / B7.5: an offline save never finishes,
  // so fail right away when offline and stop waiting after 15 seconds.
  function saveWithTimeout(save) {
    if (!navigator.onLine) return Promise.reject(new Error('You are offline.'));
    const saving = save();
    saving.catch(() => {});
    let timer;
    const timedOut = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Saving timed out. Refresh the page before trying again.')), 15000);
    });
    return Promise.race([saving, timedOut]).finally(() => clearTimeout(timer));
  }

  async function confirm() {
    setBusy(true);
    setError('');
    setRetryHint('');
    try {
      await saveWithTimeout(() => confirmExchange(requestId, user.uid, action, photo));
      navigate(action === 'return' && isOwner ? `${base}/complete` : base, { replace: true });
    } catch (cause) {
      const step = action === PHOTO_KINDS.pickup ? 'Pickup' : 'Return';
      setError(cause.message === 'Please upload a photo.'
        ? cause.message
        : `${step} could not be confirmed. ${cause.message || 'Please try again.'}`);
      setRetryHint('Your confirmation was not completed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function markPickedUp() {
    setBusy(true);
    setError('');
    try {
      await saveWithTimeout(() => confirmSellGivePickup(requestId, user.uid));
      if (type === LISTING_TYPES.give) {
        navigate(`${base}/complete`, { replace: true });
      } else {
        navigate(base, { replace: true });
      }
    } catch (cause) {
      setError(`Pickup could not be confirmed. ${cause.message || 'Please try again.'}`);
      setRetryHint('Pickup was not saved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page item-details">
      <Link to="/manage">Back to Manage</Link>
      <h1>{action === 'pickup' ? 'Pickup Confirmation' : action === 'return' ? 'Return Confirmation' : TITLES[type] || 'Ongoing Transaction'}</h1>
      {loading ? <p role="status">Loading transaction...</p> : !permitted ? (
        <p role="alert">This transaction is not available to your account.</p>
      ) : (
        <>
          <h2>{request.listingTitle || 'Item'}</h2>
          <section className="item-request">
            <h3>Ready for pick up</h3>
            {type === LISTING_TYPES.give && isOwner && <p><strong>Recipient:</strong> {request.requesterName || 'UW Student'}</p>}
            <p><strong>Pickup day:</strong> {request.pickupDate || 'Not set'}</p>
            <p><strong>Pickup time:</strong> {request.pickupTime || 'Not set'}</p>
            <p><strong>Pickup location:</strong> {request.pickupLocation || 'Not set'}</p>
          </section>
          <h3>Transaction progress</h3>
          <TransactionTimeline stages={timeline} currentStage={stage} />
          {action && !isLend ? (
            !canMarkPickup ? (
              <p>Only the {type === LISTING_TYPES.sell ? 'buyer' : 'giver'} can confirm this pickup.</p>
            ) : stage === TRANSACTION_STAGE.approved ? (
              <section className="item-request">
                <p>Please confirm that the item has been picked up.</p>
                <button type="button" disabled={busy} onClick={markPickedUp}>
                  {busy ? 'Saving...' : 'Confirm Pickup'}
                </button>
              </section>
            ) : <p>This item has already been picked up.</p>
          ) : !isLend ? (
            <>
              {stage === TRANSACTION_STAGE.approved && (
                canMarkPickup
                  ? <Link to={`${base}/pickup`}>Mark as Picked Up</Link>
                  : <p>Waiting for the {type === LISTING_TYPES.sell ? 'buyer' : 'giver'} to mark the item as picked up.</p>
              )}
              {stage === TRANSACTION_STAGE.pickup && (
                type === LISTING_TYPES.sell
                  ? <p>Pickup completed. The sale is complete.</p>
                  : <p>Pickup completed. <Link to={`${base}/complete`}>Go to Points & Rating</Link></p>
              )}
            </>
          ) : action ? (
            ((action === PHOTO_KINDS.pickup && myPickupConfirmed) ||
              (action === PHOTO_KINDS.return && myReturnConfirmed)) ? (
              <p>{action === PHOTO_KINDS.pickup
                ? 'Your pickup is confirmed. Waiting for the other person to confirm.'
                : 'Your return is confirmed.'}</p>
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
      {retryHint && <p role="status">{retryHint}</p>}
    </main>
  );
}
