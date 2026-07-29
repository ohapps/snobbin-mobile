import { atom } from 'jotai';
import type { AuthState } from '../lib/auth';

/**
 * Global auth state atom — holds the current user's auth info.
 * Updated on login/logout and read by components that need user identity.
 */
export const authStateAtom = atom<AuthState>({
  accessToken: null,
  userId: null,
  email: null,
  firstName: null,
  lastName: null,
  pictureUrl: null,
  isLoggedIn: false,
});

/**
 * Tracks whether the app has finished its initial setup (DB init, auth check).
 */
export const appReadyAtom = atom<boolean>(false);

/**
 * Sort preference for items in a group.
 */
export type ItemSortOption = 'description' | 'rating' | 'recent';
export const itemSortAtom = atom<ItemSortOption>('recent');
