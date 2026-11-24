import { saveWithTimeout } from '../data/saveWithTimeout';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FEEDBACK_TAGS, getCompletion, submitRating } from '../data/completion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../data/schema';
import './ItemDetails.css';

export default function ReturnComplete() {
  const { role, requestId } = useParams();
  const { user } = useAuth();
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pointsRecorded, setPointsRecorded] = useState(false);
  const isGive = role === 'giver' || role === 'recipient';
  const isLender = role === 'lender' || role === 'giver';
  const canRate = !isGive || role === 'giver';

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const load = async () => {
      try {
        const result = await getCompletion(requestId, user.uid);
        if (isLender !== (result.request.ownerId === user.uid)) throw new Error('Wrong transaction role.');
        if (isGive !== (result.request.listingType === 'give')) throw new Error('Wrong transaction type.');
        if (active) setCompletion(result);
      } catch (cause) {
        if (active) setError(cause.message || 'Could not load completion.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [requestId, user, isLender, isGive]);

  useEffect(() => {
    if (!user || !requestId) return undefined;
    const unsubscribeRecord = onSnapshot(
      doc(db, COLLECTIONS.pointsRecords, `${requestId}_${user.uid}`),
      snap => setPointsRecorded(snap.exists()),
      () => setPointsRecorded(false),
    );
    const unsubscribeUser = onSnapshot(
      doc(db, COLLECTIONS.users, user.uid),
      snap => setCompletion(previous => previous
        ? { ...previous, totalPoints: Number(snap.data()?.totalPoints) || 0 }
        : previous),
    );
    return () => { unsubscribeRecord(); unsubscribeUser(); };
  }, [requestId, user]);

  // R11: an offline save never finishes, so fail right away when offline
  // and stop waiting after 15 seconds.

  async function submit(event) {
    event.preventDefault();
    if (!stars) { setError('Please select a star rating.'); return; }
    setBusy(true);
    setError('');
    try {
      await saveWithTimeout(() => submitRating(requestId, user.uid, stars, tags));
      setCompletion(previous => ({ ...previous, rated: true }));
      setSuccess(true);
    } catch (cause) {
      setError(`Your rating could not be saved. ${cause.message || 'Please try again.'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page item-details">
      <Link to={`/transactions/${role}/${requestId}`}>{isGive ? 'Back to Ongoing Giveaway' : 'Back to Ongoing Borrowing'}</Link>
      <h1>{isGive ? 'Giveaway Complete' : 'Return Complete & Rating'}</h1>
      {loading ? <p role="status">Loading...</p> : completion ? (
        <>
          <h2>{completion.request.listingTitle || (isGive ? 'Item given away' : 'Item returned')}</h2>
          {isGive ? (
            <>
              <p>The item has been picked up. Thank you for giving it away!</p>
              {role === 'giver' && <p><strong>Points earned:</strong> {pointsRecorded ? '+15 points' : 'Processing completion points...'}</p>}
              <p><strong>Your total points:</strong> {completion.totalPoints}</p>
            </>
          ) : (
            <>
              <p><strong>Points earned:</strong> {pointsRecorded ? `+${isLender ? 10 : 5} points` : 'Processing completion points...'}</p>
              <p><strong>Your total points:</strong> {completion.totalPoints}</p>
            </>
          )}
          {canRate && (completion.rated ? (
                <p role="status">{success ? 'Rating submitted successfully!' : 'You have already rated this transaction.'}</p>
              ) : (
                <form onSubmit={submit} noValidate>
                  <h3>Rate {isLender ? (isGive ? 'recipient' : 'borrower') : 'lender'}</h3>
                  <fieldset>
                    <legend>Stars</legend>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" aria-label={`${n} stars`}
                        aria-pressed={n <= stars} onClick={() => setStars(n)}>
                        {n <= stars ? '★' : '☆'}
                      </button>
                    ))}
                  </fieldset>
                  <fieldset>
                    <legend>Feedback tags</legend>
                    {FEEDBACK_TAGS[role]?.map(tag => (
                      <label key={tag} style={{ display: 'block' }}>
                        <input type="checkbox" checked={tags.includes(tag)}
                          onChange={event => setTags(current => event.target.checked ? [...current, tag] : current.filter(value => value !== tag))} />
                        {tag}
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit'}</button>
                </form>
              ))}
        </>
      ) : null}
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  );
}
