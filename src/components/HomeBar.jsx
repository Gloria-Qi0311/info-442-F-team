import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/map', label: 'Map' },
  { to: '/manage', label: 'Manage' },
  { to: '/account', label: 'My Account' },
];

export default function HomeBar() {
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
    </nav>
  );
}
