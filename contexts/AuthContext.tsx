import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { type User } from '../types';
import * as authApi from '../api/auth';
import { Spinner } from '../components/common/Spinner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await authApi.getMe();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to fetch user", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  const login = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await authApi.login(email);
      if (loggedInUser) {
        setUser(loggedInUser);
        return true;
      }
      setUser(null);
      return false;
    } catch (error) {
      console.error("Login failed", error);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
