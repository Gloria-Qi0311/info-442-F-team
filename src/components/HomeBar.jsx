import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { watchUnviewedRequestCount } from '../data/requests';

const LINKS = [
  { to: '/map', label: 'Map' },
  { to: '/manage', label: 'Manage' },
  { to: '/account', label: 'My Account' },
];

export default function HomeBar() {
  const { user } = useAuth();
  const [unviewedCount, setUnviewedCount] = useState(0);

  // H4: number of unviewed requests on the user's listings, shown on "Manage".
  useEffect(() => {
    if (!user) {
      setUnviewedCount(0);
      return undefined;
    }
    return watchUnviewedRequestCount(user.uid, setUnviewedCount);
  }, [user]);

  return (
    <nav className="home-bar" aria-label="Main">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => (isActive ? 'home-bar-link active' : 'home-bar-link')}
        >
          {link.label}
          {link.to === '/manage' && unviewedCount > 0 && (
            <span className="home-bar-badge" aria-label={`${unviewedCount} unviewed requests`}>
              {unviewedCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
