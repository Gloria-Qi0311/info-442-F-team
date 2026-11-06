import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getListing } from '../data/listings';
import { pickupAreaName } from '../data/listingOptions';

// Confirmation pages L2, S2, and G2.
const CONFIRM_TEXT = {
  lend: { message: 'Your item has been listed for lending!', typeLabel: 'Borrow', ownerLabel: 'Lender' },
  sell: { message: 'Your item has been listed for sale!', typeLabel: 'Buy', ownerLabel: 'Seller' },
  give: { message: 'Your item has been listed for free!', typeLabel: 'Free', ownerLabel: 'Giver' },
};

export default function ListingConfirmation() {
  const { listingId } = useParams();
  const location = useLocation();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getListing(listingId)
      .then((data) => {
        if (!active) return;
        if (data) setListing(data);
        else setError('This listing could not be found.');
      })
      .catch((err) => {
        console.error('Could not load listing:', err);
        if (active) setError('This listing could not be loaded.');
      });
    return () => { active = false; };
  }, [listingId]);

  if (error) {
    return <main className="page"><p className="error">{error}</p></main>;
  }
  if (!listing) {
    return <main className="page"><p>Loading…</p></main>;
  }

  const text = CONFIRM_TEXT[listing.type];
  const photo = listing.photoUrl || location.state?.photoPreview;

  return (
    <main className="page">
      <h1>{text.message}</h1>
      <div className="listing-confirmation">
        {photo && <img className="listing-photo" src={photo} alt={listing.title} />}
        <dl className="account-details">
          <dt>Item</dt>
          <dd>{listing.title}</dd>
          {listing.type === 'sell' && (
            <>
              <dt>Price</dt>
              <dd>${listing.price.toFixed(2)}</dd>
            </>
          )}
          <dt>Type</dt>
          <dd>{text.typeLabel}</dd>
          <dt>{text.ownerLabel}</dt>
          <dd>{listing.ownerName}</dd>
          <dt>Pickup area</dt>
          <dd>{pickupAreaName(listing.pickupAreaId)}</dd>
          <dt>Available start date</dt>
          <dd>{listing.availableFrom}</dd>
          <dt>Available end date</dt>
          <dd>{listing.availableUntil}</dd>
          <dt>Available time slot</dt>
          <dd>{listing.timeSlot}</dd>
        </dl>
      </div>
      <Link to="/map">Back to map</Link>
    </main>
  );
}
