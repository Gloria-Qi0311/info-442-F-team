import { Link } from 'react-router-dom';

const LISTING_LINKS = [
  { to: '/manage/lend', label: 'My lending listings' },
  { to: '/manage/sell', label: 'My selling listings' },
  { to: '/manage/give', label: 'My giveaway listings' },
];

export default function Manage() {
  return (
    <main className="page">
      <h1>Manage</h1>
      <ul className="link-list">
        {LISTING_LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
