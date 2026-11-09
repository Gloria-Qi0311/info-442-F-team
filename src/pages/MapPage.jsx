import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapListings } from '../data/listings';
import { PICKUP_AREAS } from '../data/listingOptions';
import './MapPage.css';

// Issue 3.1: campus map with a marker for each active listing (F2.1–F2.3, LS2–LS3, NF1).

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
function buildMarkers(listings) {
  const byArea = {};
  listings.forEach((listing) => {
    if (!byArea[listing.pickupAreaId]) {
      byArea[listing.pickupAreaId] = [];
    }
    byArea[listing.pickupAreaId].push(listing);
  });

  const markers = [];
  PICKUP_AREAS.forEach((area) => {
    const inArea = byArea[area.id] || [];
    inArea.forEach((listing, i) => {
      markers.push({ listing, area, position: markerPosition(area, i, inArea.length) });
    });
  });
  return markers;
}

export default function MapPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMapListings()
      .then((result) => {
        if (!cancelled) {
          setListings(result);
        }
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

  const markers = buildMarkers(listings);

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

      {loading && <p className="map-status">Loading items…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && markers.length === 0 && (
        <p className="map-status">No items are available right now.</p>
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
                  {listing.type === 'sell' && listing.price != null && ` · $${listing.price}`}
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

      <Link to="/post" className="post-button" aria-label="Post Items" title="Post Items">
        +
      </Link>
    </main>
  );
}
