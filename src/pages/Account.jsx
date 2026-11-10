import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCurrentUser } from '../data/currentUser';

export default function Account() {
  const user = useCurrentUser();
  const { signOutUser } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOutUser();
      navigate('/verify', { replace: true });
    } catch (error) {
      console.error('Could not sign out:', error);
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
      <button type="button" className="account-sign-out" onClick={handleSignOut}>
        Sign Out
      </button>
    </main>
  );
}
