import { atom, getDefaultStore } from 'jotai';
import type { AuthState } from '../lib/auth';

/**
 * Shared Jotai store instance used across both React component tree and background services.
 */
export const store = getDefaultStore();

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

/**
 * Global sync status for background data fetching.
 * - idle: no sync in progress
 * - syncing: fetching from API
 * - error: last sync attempt failed (app still works offline with cached data)
 */
export type SyncStatus = 'idle' | 'syncing' | 'error';
export const syncStatusAtom = atom<SyncStatus>('idle');

/** ISO timestamp of the last successful sync, persisted across app restarts. */
export const lastSyncedAtAtom = atom<Date | null>(null);

/** Group IDs currently being synced from the API. */
export const syncingGroupIdsAtom = atom<string[]>([]);
