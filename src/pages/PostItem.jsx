import { Link } from 'react-router-dom';

const OPTIONS = [
  { to: '/post/lend', label: 'Lend', hint: 'Set dates & return rules', className: 'lend' },
  { to: '/post/sell', label: 'Sell', hint: 'Set prices & pickup location', className: 'sell' },
  { to: '/post/give', label: 'Give', hint: 'Your item will continue to shine', className: 'give' },
];

export default function PostItem() {
  return (
    <main className="page">
      <h1>Post an item</h1>
      <p>Choose one transaction type</p>
      <ul className="post-options">
        {OPTIONS.map((option) => (
          <li key={option.to}>
            <Link to={option.to} className="post-option">
              <span className={`post-option-label ${option.className}`}>{option.label}</span>
              <span className="post-option-hint">{option.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
