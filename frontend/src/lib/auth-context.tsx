'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';

export interface UserMembership {
  orgId: string;
  orgName: string;
  roleName: string;
  isActive: boolean;
}

export interface UserProfile {
  id: string;
  userId?: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  terminalLocked: boolean;
  avatarUrl?: string;
  lastLoginAt?: string;
  isPlatformSuperAdmin?: boolean;
  activeOrgId?: string;
  orgName?: string;
  memberships?: UserMembership[];
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTerminalLocked: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<UserProfile>;
  logout: () => Promise<void>;
  lockTerminal: () => Promise<void>;
  unlockTerminal: (pin: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Switches the active organization and resets all cached per-org data. */
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_CHECK_TIMEOUT_MS = 8000; // 8 seconds max wait

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const mountedRef = useRef(true);
  const queryClient = useQueryClient();

  const refreshUser = useCallback(async () => {
    // If no token exists in this tab's sessionStorage, do not fetch /auth/me
    // to prevent picking up another tab's cookie session.
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('pos_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);

    try {
      const res = await apiClient<UserProfile>('/auth/me', { signal: controller.signal });
      if (!mountedRef.current) return;
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pos_token');
        }
        setUser(null);
      }
    } catch {
      if (!mountedRef.current) return;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pos_token');
      }
      setUser(null);
    } finally {
      clearTimeout(timeoutId);
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshUser();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshUser]);

  const login = async (username: string, password: string, rememberMe: boolean = false): Promise<UserProfile> => {
    const res = await apiClient<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    });

    if (res.success && res.data) {
      if (typeof window !== 'undefined' && res.data.token) {
        sessionStorage.setItem('pos_token', res.data.token);
      }
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error('Login response invalid');
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pos_token');
      }
      setUser(null);
    }
  };

  const lockTerminal = async (): Promise<void> => {
    await apiClient('/auth/lock-terminal', { method: 'POST' });
    setUser((prev) => (prev ? { ...prev, terminalLocked: true } : null));
  };

  const unlockTerminal = async (pin: string): Promise<void> => {
    await apiClient('/auth/unlock-terminal', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    setUser((prev) => (prev ? { ...prev, terminalLocked: false } : null));
  };

  const switchOrganization = async (orgId: string): Promise<void> => {
    const res = await apiClient<{ token: string; user: UserProfile }>('/auth/switch-org', {
      method: 'POST',
      body: JSON.stringify({ orgId }),
    });

    if (res.success && res.data) {
      if (typeof window !== 'undefined' && res.data.token) {
        sessionStorage.setItem('pos_token', res.data.token);
      }
      // Everything cached (lists, reports, branding) belongs to the previous
      // organization — drop it before the new context renders.
      queryClient.clear();
      setUser(res.data.user);
      return;
    }
    throw new Error('Organization switch response invalid');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isTerminalLocked: !!user?.terminalLocked,
        login,
        logout,
        lockTerminal,
        unlockTerminal,
        refreshUser,
        switchOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
