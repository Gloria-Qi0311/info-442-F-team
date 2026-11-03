import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const LINKS = [
  { to: '/map', label: 'Map' },
  { to: '/manage', label: 'Manage' },
  { to: '/account', label: 'My Account' },
];

export default function HomeBar() {
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
    <nav className="home-bar" aria-label="Main">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => (isActive ? 'home-bar-link active' : 'home-bar-link')}
        >
          {link.label}
        </NavLink>
      ))}
      <button type="button" className="home-bar-sign-out" onClick={handleSignOut}>
        Sign Out
      </button>
    </nav>
  );
}
