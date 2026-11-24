import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCurrentUser } from '../data/currentUser';

export default function Account() {
  const user = useCurrentUser();
  const { signOutUser } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

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
