
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Storage from '../services/storageService';

export const useAuth = () => {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // User State
  const [currentUser, setCurrentUser] = useState<User | null>(Storage.getCurrentSession());

  const login = (user: User) => {
      setCurrentUser(user);
  };

  const logout = () => {
    Storage.logout();
    setCurrentUser(null);
  };

  return {
      currentUser,
      login,
      logout,
      isDarkMode,
      toggleTheme
  };
};
