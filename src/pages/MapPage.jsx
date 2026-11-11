import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapListings, getOwnerPoints } from '../data/listings';
import { PICKUP_AREAS } from '../data/listingOptions';
import { usePickupAreas } from '../data/pickupAreas';
import './MapPage.css';

// Issue 3.1: campus map with a marker for each active listing (F2.1–F2.3, LS2–LS3, NF1).
// Issue #11: keyword search and Borrow / Buy / Free filters (F2.4–F2.11, P5, NF2).

// Start zoomed so every pickup area fits on screen.
const CAMPUS_BOUNDS = PICKUP_AREAS.map((area) => [area.lat, area.lng]);

// Marker colors: blue = Borrow, yellow = Buy, green = Free.
const TYPE_STYLES = {
  lend: { label: 'Borrow', color: '#3b82f6' },
  sell: { label: 'Buy', color: '#facc15' },
  give: { label: 'Free', color: '#86c97a' },
};

// Several listings can share one pickup area. Spread them in a small circle
// around the area so their markers don't sit exactly on top of each other.
function markerPosition(area, indexInArea, countInArea) {
  if (countInArea === 1) {
    return [area.lat, area.lng];
  }
  const angle = (2 * Math.PI * indexInArea) / countInArea;
  const spread = 0.00018;
  return [area.lat + spread * Math.sin(angle), area.lng + spread * Math.cos(angle)];
}

// Pairs each listing with its map position. Listings whose pickup area is
// unknown are left off the map.
function buildMarkers(listings, areas) {
  const byArea = {};
  listings.forEach((listing) => {
    if (!byArea[listing.pickupAreaId]) {
      byArea[listing.pickupAreaId] = [];
    }
    byArea[listing.pickupAreaId].push(listing);
  });

  const markers = [];
  areas.forEach((area) => {
    const inArea = byArea[area.id] || [];
    inArea.forEach((listing, i) => {
      markers.push({ listing, area, position: markerPosition(area, i, inArea.length) });
    });
  });
  return markers;
}

export default function MapPage() {
  const pickupAreas = usePickupAreas();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerPoints, setOwnerPoints] = useState({});
  const [category, setCategory] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMapListings()
      .then((result) => {
        if (!cancelled) {
          setListings(result);
        }
        // Owner points are only used to order search results (P5).
        return getOwnerPoints(result.map((listing) => listing.ownerId)).then((points) => {
          if (!cancelled) {
            setOwnerPoints(points);
          }
        });
      })
      .catch((err) => {
        console.error('Could not load listings for the map:', err);
        if (!cancelled) {
          setError('Could not load items on the map. Please refresh and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // F2.4–F2.7: clicking the selected category again deselects it.
  function toggleCategory(type) {
    setCategory((current) => (current === type ? null : type));
  }

  function handleSearch(event) {
    event.preventDefault();
    setKeyword(searchText.trim());
  }

  // F2.8, F2.10: item name contains the keyword (ignoring case) and matches the category.
  const lowerKeyword = keyword.toLowerCase();
  const filtered = listings.filter(
    (listing) =>
      (!category || listing.type === category) &&
      (!lowerKeyword || (listing.title || '').toLowerCase().includes(lowerKeyword)),
  );
  const markers = buildMarkers(filtered, pickupAreas);

  // F2.9, P5: results list ordered by the owner's total points, highest first.
  const results = keyword
    ? [...filtered].sort((a, b) => (ownerPoints[b.ownerId] || 0) - (ownerPoints[a.ownerId] || 0))
    : [];
  const filtering = Boolean(category || keyword);

  return (
    <main className="page map-page">
      <h1>Map</h1>

      <ul className="map-legend" aria-label="Map legend">
        {Object.keys(TYPE_STYLES).map((type) => (
          <li key={type}>
            <span className="map-legend-dot" style={{ background: TYPE_STYLES[type].color }} />
            {TYPE_STYLES[type].label}
          </li>
        ))}
      </ul>

      <form className="map-search" onSubmit={handleSearch} role="search">
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search items"
          aria-label="Search items by name"
        />
        <button type="submit">Search</button>
      </form>

      <div className="map-filters" role="group" aria-label="Filter by category">
        {Object.keys(TYPE_STYLES).map((type) => (
          <button
            key={type}
            type="button"
            className={category === type ? 'map-filter selected' : 'map-filter'}
            aria-pressed={category === type}
            onClick={() => toggleCategory(type)}
          >
            {TYPE_STYLES[type].label}
          </button>
        ))}
      </div>

      {loading && <p className="map-status">Loading items…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && listings.length === 0 && !filtering && (
        <p className="map-status">No items are available right now.</p>
      )}
      {/* F2.11 */}
      {!loading && !error && filtering && filtered.length === 0 && (
        <p className="map-status">No items found</p>
      )}

      <div className="map-frame">
        <MapContainer
          bounds={CAMPUS_BOUNDS}
          boundsOptions={{ padding: [30, 30] }}
          preferCanvas
          className="campus-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers.map(({ listing, area, position }) => {
            const style = TYPE_STYLES[listing.type] || TYPE_STYLES.lend;
            return (
              <CircleMarker
                key={listing.id}
                center={position}
                radius={9}
                pathOptions={{ color: '#1f1f1f', weight: 1, fillColor: style.color, fillOpacity: 0.95 }}
              >
                <Popup>
                  <strong>{listing.title}</strong>
                  <br />
                  {style.label}
                  {listing.type === 'sell' && listing.price != null && ` · $${Number(listing.price).toFixed(2)}`}
                  <br />
                  Pickup: {area.name}
                  <br />
                  {/* Item details pages are Issue 3.3 */}
                  <Link to={`/listings/${listing.id}`}>View item</Link>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {results.length > 0 && (
        <ul className="map-results" aria-label="Search results">
          {results.map((listing) => (
            <li key={listing.id}>
              <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
              <span className="map-results-meta">
                {' · '}
                {(TYPE_STYLES[listing.type] || TYPE_STYLES.lend).label}
                {listing.type === 'sell' && listing.price != null && ` · $${Number(listing.price).toFixed(2)}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link to="/post" className="post-button" aria-label="Post Items" title="Post Items">
        +
      </Link>
    </main>
  );
}
