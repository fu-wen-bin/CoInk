'use client';

import { createContext, ReactNode, useContext } from 'react';

import { User } from '@/services/users/types';

interface UserProfileContextType {
  user: User | undefined;
  isLoading: boolean;
  error: Error | null;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

interface UserProfileProviderProps {
  children: ReactNode;
  user: User | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function UserProfileProvider({
  children,
  user,
  isLoading,
  error,
}: UserProfileProviderProps) {
  return (
    <UserProfileContext.Provider value={{ user, isLoading, error }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);

  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }

  return context;
}
