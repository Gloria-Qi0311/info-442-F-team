import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

function isVerifiedUwUser(user) {
  return Boolean(
    user
      && user.email
      && user.email.toLowerCase().endsWith('@uw.edu')
      && user.emailVerified,
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (isVerifiedUwUser(firebaseUser)) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        if (firebaseUser) {
          signOut(auth).catch((error) => {
            console.error('Could not sign out an unverified account:', error);
          });
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const signedInUser = result.user;

    if (!signedInUser.email || !signedInUser.email.toLowerCase().endsWith('@uw.edu')) {
      await signOut(auth);
      throw new Error('Please use your UW email address ending in @uw.edu.');
    }

    if (!signedInUser.emailVerified) {
      await signOut(auth);
      throw new Error('Your Google account email is not verified. Please verify it and try again.');
    }

    setUser(signedInUser);
    return signedInUser;
  }

  async function signOutUser() {
    await signOut(auth);
    setUser(null);
  }

  const value = { user, loading, signInWithGoogle, signOutUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
