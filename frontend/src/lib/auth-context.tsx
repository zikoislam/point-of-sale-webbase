'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from './api-client';

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
  lastLoginAt?: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient<UserProfile>('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string, rememberMe: boolean = false): Promise<UserProfile> => {
    const res = await apiClient<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    });

    if (res.success && res.data) {
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error('Login response invalid');
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
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
