import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="page">
      <h1>Husky Share</h1>
      <p>Lend, borrow, sell and give away items with other UW students.</p>
      <p>
        Setup check: <Link to="/dev/db-check">Database check</Link>
      </p>
    </main>
  );
}
