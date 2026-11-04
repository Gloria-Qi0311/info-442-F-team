import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import MapPage from './pages/MapPage';
import Manage from './pages/Manage';
import Account from './pages/Account';
import PostItem from './pages/PostItem';
import ListingForm from './pages/ListingForm';
import ListingConfirmation from './pages/ListingConfirmation';
import Placeholder from './pages/Placeholder';
import DbCheck from './pages/DbCheck';
import Verification from './pages/Verification';

const LATER = 'Coming in Milestone 2.';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/verify" element={<Verification />} />
          <Route
            element={(
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            )}
          >
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/manage" element={<Manage />} />
            <Route path="/manage/lend" element={<Placeholder title="My Lending Listings" note={LATER} />} />
            <Route path="/manage/sell" element={<Placeholder title="My Selling Listings" note={LATER} />} />
            <Route path="/manage/give" element={<Placeholder title="My Giveaway Listings" note={LATER} />} />
            <Route path="/account" element={<Account />} />
            <Route path="/post" element={<PostItem />} />
            <Route path="/post/lend" element={<ListingForm key="lend" type="lend" />} />
            <Route path="/post/sell" element={<ListingForm key="sell" type="sell" />} />
            <Route path="/post/give" element={<ListingForm key="give" type="give" />} />
            <Route path="/listings/:listingId/confirmation" element={<ListingConfirmation />} />
            <Route path="/dev/db-check" element={<DbCheck />} />
          </Route>
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
