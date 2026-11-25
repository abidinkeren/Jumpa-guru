import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { AuthUser, UserRole } from '../types/index.ts';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
  loginWithPassword: (email: string, password: string) => Promise<AuthUser>;
  registerAccount: (payload: Record<string, unknown>) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  setSessionFromToken: (token: string, user: AuthUser) => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/dashboard/admin';
    case 'teacher':
      return '/dashboard/guru';
    case 'parent':
      return '/dashboard/orang-tua';
    default:
      return '/dashboard/siswa';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const tokenRef = useRef<string | null>(null);

  const updateToken = useCallback((nextToken: string | null) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
  }, []);

  const apiFetch = useCallback(async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (tokenRef.current) {
      headers.set('Authorization', `Bearer ${tokenRef.current}`);
    }

    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!res.ok) {
      const errMsg =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Permintaan gagal (${res.status})`;
      throw new Error(errMsg);
    }
    return data as T;
  }, []);

  // Listen to Firebase Google Sign-In state if user previously signed in via Google
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      if (fbUser && !tokenRef.current) {
        try {
          const idToken = await fbUser.getIdToken();
          updateToken(idToken);
          const resp = await fetch('/api/auth/firebase', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (resp.ok && active) {
            const data = await resp.json();
            setUser(data.user);
          }
        } catch {
          // Ignore Firebase sync error on boot
        }
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [updateToken]);

  const setSessionFromToken = useCallback(
    (nextToken: string, nextUser: AuthUser) => {
      updateToken(nextToken);
      setUser(nextUser);
    },
    [updateToken]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      updateToken(res.token);
      setUser(res.user);
      return res.user;
    },
    [apiFetch, updateToken]
  );

  const registerAccount = useCallback(
    async (payload: Record<string, unknown>): Promise<AuthUser> => {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      updateToken(res.token);
      setUser(res.user);
      return res.user;
    },
    [apiFetch, updateToken]
  );

  const loginWithGoogle = useCallback(async (): Promise<AuthUser> => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    updateToken(idToken);
    const res = await fetch('/api/auth/firebase', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal masuk dengan Google.');
    }
    setUser(data.user);
    return data.user;
  }, [updateToken]);

  const refreshProfile = useCallback(async () => {
    if (!tokenRef.current) return;
    const data = await apiFetch<{ user: AuthUser }>('/api/auth/me');
    setUser(data.user);
  }, [apiFetch]);

  const logout = useCallback(async () => {
    updateToken(null);
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore if not signed into Firebase
    }
  }, [updateToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        loginWithPassword,
        registerAccount,
        loginWithGoogle,
        setSessionFromToken,
        refreshProfile,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
