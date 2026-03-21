'use client';

import { createContext, useContext, useMemo } from 'react';

import { getAvatar } from '@/lib/tiptap-collab-utils';
import { getCursorColorByUserId } from '@/utils';

export type User = {
  id: string;
  name: string;
  color: string;
  avatar: string;
};

export type UserContextValue = {
  user: User;
};

export const UserContext = createContext<UserContextValue>({
  user: { color: '', id: '', name: '', avatar: '' },
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const user = useMemo<User>(() => resolveUserFromStorage(), []);

  return <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);

type CachedUserProfile = {
  userId?: string;
  name?: string;
  avatarUrl?: string;
};

const STORAGE_KEYS = {
  profile: 'cached_user_profile',
  username: '_tiptap_username',
  userId: '_tiptap_user_id',
} as const;

const uuid = (): string => {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getFromLocalStorage = (
  key: string,
  fallback: () => string,
  isServer: boolean = typeof window === 'undefined',
): string => {
  if (isServer) {
    return fallback();
  }
  const value = window.localStorage.getItem(key);
  return value !== null ? value : fallback();
};

const getCachedProfile = (): CachedUserProfile | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.profile);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CachedUserProfile;
  } catch {
    return null;
  }
};

const getUsernameFromStorage = (profile: CachedUserProfile | null): string => {
  return profile?.name?.trim() || getFromLocalStorage(STORAGE_KEYS.username, () => 'CoInk User');
};

const getUserIdFromStorage = (profile: CachedUserProfile | null): string => {
  return profile?.userId?.trim() || getFromLocalStorage(STORAGE_KEYS.userId, uuid);
};

const resolveUserFromStorage = (): User => {
  const profile = getCachedProfile();
  const id = getUserIdFromStorage(profile);
  const name = getUsernameFromStorage(profile);
  const avatar = profile?.avatarUrl?.trim() || getAvatar(name);
  const color = getCursorColorByUserId(id || name);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.username, name);
    window.localStorage.setItem(STORAGE_KEYS.userId, id);
  }

  return {
    id,
    name,
    color,
    avatar,
  };
};
