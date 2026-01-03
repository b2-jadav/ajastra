import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, vehicleId?: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  changeAdminPassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  isAdmin: boolean;
  isDriver: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_ADMIN_PASSWORD = '12345';
const ADMIN_PASSWORD_KEY = 'ajastra_admin_password';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Initialize admin password from localStorage or use default
  const initAdminPassword = useCallback(() => {
    const stored = localStorage.getItem(ADMIN_PASSWORD_KEY);
    if (!stored) {
      // Store hashed default password (simple hash for demo)
      const hash = btoa(DEFAULT_ADMIN_PASSWORD);
      localStorage.setItem(ADMIN_PASSWORD_KEY, hash);
    }
  }, []);

  React.useEffect(() => {
    initAdminPassword();
  }, [initAdminPassword]);

  const login = useCallback(async (
    role: UserRole,
    vehicleId?: string,
    password?: string
  ): Promise<boolean> => {
    if (role === 'admin') {
      // Admin login requires password
      if (!password) return false;
      
      const storedHash = localStorage.getItem(ADMIN_PASSWORD_KEY) || btoa(DEFAULT_ADMIN_PASSWORD);
      const providedHash = btoa(password);
      
      if (storedHash === providedHash) {
        setUser({ role: 'admin', vehicleId: undefined });
        return true;
      }
      return false;
    } else if (role === 'driver') {
      // Driver login requires vehicleId
      if (!vehicleId) return false;
      setUser({ role: 'driver', vehicleId });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const changeAdminPassword = useCallback(async (
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    const storedHash = localStorage.getItem(ADMIN_PASSWORD_KEY);
    const oldHash = btoa(oldPassword);
    
    if (storedHash === oldHash) {
      const newHash = btoa(newPassword);
      localStorage.setItem(ADMIN_PASSWORD_KEY, newHash);
      return true;
    }
    return false;
  }, []);

  const isAdmin = user?.role === 'admin';
  const isDriver = user?.role === 'driver';

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        changeAdminPassword,
        isAdmin,
        isDriver,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
