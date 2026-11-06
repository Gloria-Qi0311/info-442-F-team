import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { db } from '../firebase';
import { COLLECTIONS, LISTING_TYPES, LISTING_STATUS } from '../data/schema';
import './ManageListings.css';

const titles = { lend: 'My Lending Listings', sell: 'My Selling Listings', give: 'My Giveaway Listings' };

function expired(item) {
  if (item.status !== LISTING_STATUS.active || !item.availableUntil) return false;
  const raw = item.availableUntil;
  const end = typeof raw.toDate === 'function' ? raw.toDate() : new Date(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T23:59:59' : raw);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

export default function ManageListings() {
  const { type } = useParams();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      setItems([]);
      setSearch('');
      if (!user || !titles[type]) { setLoading(false); return; }
      try {
        const snapshot = await getDocs(query(collection(db, COLLECTIONS.listings),
          where('ownerId', '==', user.uid), where('type', '==', LISTING_TYPES[type])));
        const records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        if (!active) return;
        setItems(records);
        const updates = await Promise.allSettled(records.filter(expired).map((item) =>
          updateDoc(doc(db, COLLECTIONS.listings, item.id), { status: LISTING_STATUS.inactive })));
        if (!active) return;
        if (updates.some((result) => result.status === 'rejected')) {
          setError('Some expired statuses could not be saved.');
        }
        setItems(records.map((item) => expired(item) ? { ...item, status: LISTING_STATUS.inactive } : item));
      } catch (cause) {
        console.error(cause);
        if (active) setError('Could not load listings. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user, type]);

  const visible = items.filter((item) =>
    (item.title || item.itemName || '').toLowerCase().includes(search.trim().toLowerCase()));

  if (!titles[type]) return <main className="page"><p>Unknown listing type.</p><Link to="/manage">Back</Link></main>;

  return (
    <main className="page manage-listings">
      <Link className="manage-back" to="/manage">Back to Manage</Link>
      <h1>{titles[type]}</h1>
      <label htmlFor="listing-search">Search by item name</label>
      <input id="listing-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search my listings" />
      {error && <p role="alert" className="error">{error}</p>}
      {loading ? <p role="status">Loading listings...</p> : visible.length === 0 ?
        <p role="status" className="manage-empty">{search.trim() ? 'No listings match your search.' : 'You have no listings of this type yet.'}</p> :
        <ul className="manage-cards">{visible.map((item) =>
          <li key={item.id} className="manage-card">
            {item.photoUrl ? <img src={item.photoUrl} alt={item.title || 'Item'} /> : <div className="manage-no-photo">No photo</div>}
            <div className="manage-card-info">
              <h2>{item.title || item.itemName || 'Untitled item'}</h2>
              <p><strong>Status:</strong> <span className="manage-status">{expired(item) ? LISTING_STATUS.inactive : item.status || LISTING_STATUS.active}</span></p>
              {item.category && <p><strong>Category:</strong> {item.category}</p>}
              {item.condition && <p><strong>Condition:</strong> {item.condition}</p>}
              {item.description && <p>{item.description}</p>}
              {type === 'sell' && item.price != null && <p><strong>Price:</strong> {item.price}</p>}
              {item.availableUntil && <p><strong>Available until:</strong> {String(item.availableUntil)}</p>}
            </div>
          </li>)}</ul>}
    </main>
  );
}
