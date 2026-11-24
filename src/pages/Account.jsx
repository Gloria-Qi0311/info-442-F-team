import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useCurrentUser } from '../data/currentUser';
import { db } from '../firebase';
import { COLLECTIONS } from '../data/schema';

export default function Account() {
  const user = useCurrentUser();
  const { user: authUser, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [totalPoints, setTotalPoints] = useState(null);

  // #22 / P4: show the user's current total points, updated live.
  useEffect(() => {
    if (!authUser) return undefined;
    return onSnapshot(
      doc(db, COLLECTIONS.users, authUser.uid),
      (snap) => setTotalPoints(snap.exists() ? Number(snap.data().totalPoints) || 0 : 0),
      () => setTotalPoints(null),
    );
  }, [authUser]);

  async function handleSignOut() {
  if (isSigningOut) return;

  setIsSigningOut(true);
  setSignOutError('');

  try {
    await signOutUser();
    navigate('/verify', { replace: true });
  } catch (error) {
    console.error('Could not sign out:', error);
    setSignOutError('Could not sign out. Please try again.');
  } finally {
    setIsSigningOut(false);
  }
}

  return (
    <main className="page">
      <h1>My Account</h1>
      <dl className="account-details">
        <dt>Name</dt>
        <dd>{user.name}</dd>
        <dt>UW email</dt>
        <dd>{user.uwEmail}</dd>
        <dt>Total points</dt>
        <dd>{totalPoints === null ? 'Loading...' : totalPoints}</dd>
      </dl>
      <button
        type="button"
        className="account-sign-out"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? 'Signing out...' : 'Sign Out'}
      </button>
      {signOutError && (
        <p role="alert" className="error">
          {signOutError}
        </p>
      )}
      </main>
  );
}
