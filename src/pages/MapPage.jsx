import { Link } from 'react-router-dom';

// The map and search are built in Milestone 3 (F2.1–F2.15).
export default function MapPage() {
  return (
    <main className="page map-page">
      <h1>Map</h1>
      <p className="placeholder">The campus map is coming in Milestone 3.</p>
      <Link to="/post" className="post-button" aria-label="Post Items" title="Post Items">
        +
      </Link>
    </main>
  );
}
