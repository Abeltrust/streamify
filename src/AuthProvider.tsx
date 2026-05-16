import { ReactNode, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useAuthStore } from './store/authStore';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return <>{children}</>;
}
