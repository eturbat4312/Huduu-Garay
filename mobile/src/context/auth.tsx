import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { fetchMe, googleLogin as apiGoogleLogin, login as apiLogin, logout as apiLogout, signup as apiSignup, ACCESS_TOKEN_KEY, setAuthInvalidatedListener } from '@/lib/api';
import { getItem } from '@/lib/storage';
import { storeFacebookTokens } from '@/lib/facebook';
import type { UserProfile } from '@/types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'authenticated'; user: UserProfile };

type AuthContextValue = {
  state: AuthState;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  acceptFacebookSession: (tokens: { access: string; refresh: string }) => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const loadUser = useCallback(async (currentState?: AuthState) => {
    const token = await getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setState({ status: 'guest' });
      return;
    }
    try {
      const user = await fetchMe();
      setState({ status: 'authenticated', user });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        // Token дууссан эсвэл хүчингүй → заавал logout
        setState({ status: 'guest' });
      } else if (currentState?.status !== 'authenticated') {
        // Network алдаа / 5xx: аль хэдийн нэвтэрсэн бол хэвээр үлдээ,
        // харин эхний ачааллах үед token байсан ч /me/ хаягаас алдаа гарвал guest болго
        setState({ status: 'guest' });
      }
      // else: аль хэдийн authenticated + network/server алдаа → state хэвээр
    }
  }, []);

  useEffect(() => {
    // SecureStore дахь session-ийг анхны render-ийн дараа auth state-тай синк хийнэ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    setAuthInvalidatedListener(() => setState({ status: 'guest' }));
    return () => setAuthInvalidatedListener(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const user = await fetchMe();
    setState({ status: 'authenticated', user });
  }, []);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    await apiSignup(email, username, password);
    const user = await fetchMe();
    setState({ status: 'authenticated', user });
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    await apiGoogleLogin(idToken);
    const user = await fetchMe();
    setState({ status: 'authenticated', user });
  }, []);

  const acceptFacebookSession = useCallback(async (tokens: { access: string; refresh: string }) => {
    await storeFacebookTokens(tokens);
    const user = await fetchMe();
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ status: 'guest' });
  }, []);

  const refresh = useCallback(async () => {
    await loadUser(state);
  }, [loadUser, state]);

  const value: AuthContextValue = {
    state,
    user: state.status === 'authenticated' ? state.user : null,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    login,
    signup,
    logout,
    refresh,
    loginWithGoogle,
    acceptFacebookSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
