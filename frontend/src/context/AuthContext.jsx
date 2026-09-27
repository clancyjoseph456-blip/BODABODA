/**
 * AuthContext — single source of truth for the signed-in user.
 *
 * On boot it re-validates any stored token against /auth/me. Trusting localStorage
 * blindly would let the UI render a dashboard for a session the server has
 * already rejected.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Restore an existing session once, on first render.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) setUser(data);
      } catch {
        // Token rejected or expired — drop it rather than showing a dead session.
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // The API layer fires this when a request comes back 401 mid-session.
  useEffect(() => {
    window.addEventListener('boda:session-expired', signOut);
    return () => window.removeEventListener('boda:session-expired', signOut);
  }, [signOut]);

  const signIn = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      register,
      signOut,
      isAdmin: user?.role === 'admin',
      isOwner: user?.role === 'owner',
      isRider: user?.role === 'rider'
    }),
    [user, loading, signIn, register, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
