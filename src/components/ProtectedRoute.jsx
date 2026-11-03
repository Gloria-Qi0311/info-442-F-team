import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="page" aria-live="polite">
        <p>Checking your sign-in...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/verify" replace />;
  }

  return children;
}
