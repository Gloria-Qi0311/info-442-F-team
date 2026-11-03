import { useAuth } from '../auth/AuthContext';

// Keep the existing hook API so pages using useCurrentUser do not need to change.
export function useCurrentUser() {
  const { user } = useAuth();

  return {
    name: user?.displayName || 'UW Student',
    uwEmail: user?.email || '',
  };
}
