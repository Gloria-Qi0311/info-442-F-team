import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import MapPage from './pages/MapPage';
import Manage from './pages/Manage';
import ManageListings from './pages/ManageListings';
import Account from './pages/Account';
import PostItem from './pages/PostItem';
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
            <Route path="/manage/:type" element={<ManageListings />} />
            <Route path="/account" element={<Account />} />
            <Route path="/post" element={<PostItem />} />
            <Route path="/post/lend" element={<Placeholder title="Lend an Item" note={LATER} />} />
            <Route path="/post/sell" element={<Placeholder title="Sell an Item" note={LATER} />} />
            <Route path="/post/give" element={<Placeholder title="Give Away an Item" note={LATER} />} />
            <Route path="/dev/db-check" element={<DbCheck />} />
          </Route>
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
