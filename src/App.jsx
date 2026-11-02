import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MapPage from './pages/MapPage';
import Manage from './pages/Manage';
import Account from './pages/Account';
import PostItem from './pages/PostItem';
import Placeholder from './pages/Placeholder';
import DbCheck from './pages/DbCheck';

const LATER = 'Coming in Milestone 2.';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pages with the home bar (H1). The verification page goes outside this group. */}
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/manage/lend" element={<Placeholder title="My Lending Listings" note={LATER} />} />
          <Route path="/manage/sell" element={<Placeholder title="My Selling Listings" note={LATER} />} />
          <Route path="/manage/give" element={<Placeholder title="My Giveaway Listings" note={LATER} />} />
          <Route path="/account" element={<Account />} />
          <Route path="/post" element={<PostItem />} />
          <Route path="/post/lend" element={<Placeholder title="Lend an Item" note={LATER} />} />
          <Route path="/post/sell" element={<Placeholder title="Sell an Item" note={LATER} />} />
          <Route path="/post/give" element={<Placeholder title="Give Away an Item" note={LATER} />} />
        </Route>
        <Route path="/dev/db-check" element={<DbCheck />} />
      </Routes>
    </BrowserRouter>
  );
}
