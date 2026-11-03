import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function getErrorMessage(error) {
  if (error.message?.includes('UW email') || error.message?.includes('not verified')) {
    return error.message;
  }

  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return 'The sign-in window was closed. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Please allow pop-ups and try again.';
    case 'auth/unauthorized-domain':
      return 'This website domain has not been added to Firebase authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-in has not been enabled in Firebase Authentication yet.';
    case 'auth/network-request-failed':
      return 'A network error occurred. Check your connection and try again.';
    default:
      return 'We could not sign you in. Please try again.';
  }
}

export default function Verification() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <main className="verification-page"><p>Checking your sign-in...</p></main>;
  }

  if (user) {
    return <Navigate to="/map" replace />;
  }

  async function handleGoogleSignIn() {
    setError('');
    setSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (signInError) {
      setError(getErrorMessage(signInError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="verification-page">
      <section className="verification-card">
        <h1>Welcome to Husky Share</h1>
        <p>Sign in with your UW Google account to join your campus community.</p>
        <button
          type="button"
          className="google-sign-in"
          onClick={handleGoogleSignIn}
          disabled={submitting}
        >
          {submitting ? 'Signing in...' : 'Continue with Google'}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="verification-note">
          Only verified UW email accounts ending in @uw.edu can access Husky Share.
        </p>
      </section>
    </main>
  );
}
