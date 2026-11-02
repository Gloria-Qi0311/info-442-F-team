import { Outlet } from 'react-router-dom';
import HomeBar from './HomeBar';

// Wraps every page except the verification page (H1).
export default function Layout() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>
      <HomeBar />
    </div>
  );
}
