import { getDefaultStore } from 'jotai';
import { lastSyncedAtAtom, syncStatusAtom, syncingGroupIdsAtom } from '../store/atoms';
import { getMetadataValue, setMetadataValue, deleteMetadataValue } from './auth';

const LAST_SYNCED_AT_KEY = 'last_synced_at';
const store = getDefaultStore();

function getSyncingGroupIds(): string[] {
  return store.get(syncingGroupIdsAtom);
}

export function getLastSyncedAt(): Date | null {
  return store.get(lastSyncedAtAtom);
}

export function isGroupSyncing(groupId: string): boolean {
  return getSyncingGroupIds().includes(groupId);
}

export function isAnyGroupSyncing(): boolean {
  return getSyncingGroupIds().length > 0;
}

export async function initSyncState(): Promise<void> {
  const persisted = await getMetadataValue(LAST_SYNCED_AT_KEY);
  if (persisted) {
    const parsed = new Date(persisted);
    if (!Number.isNaN(parsed.getTime())) {
      store.set(lastSyncedAtAtom, parsed);
    }
  }
}

export async function clearSyncState(): Promise<void> {
  store.set(syncStatusAtom, 'idle');
  store.set(lastSyncedAtAtom, null);
  store.set(syncingGroupIdsAtom, []);
  await deleteMetadataValue(LAST_SYNCED_AT_KEY);
}

export function beginGlobalSync(): void {
  store.set(syncStatusAtom, 'syncing');
}

export function endGlobalSync(success: boolean): void {
  store.set(syncStatusAtom, success ? 'idle' : 'error');
}

export function beginGroupSync(groupId: string): void {
  const current = getSyncingGroupIds();
  if (!current.includes(groupId)) {
    store.set(syncingGroupIdsAtom, [...current, groupId]);
  }
}

export function endGroupSync(groupId: string): void {
  store.set(
    syncingGroupIdsAtom,
    getSyncingGroupIds().filter((id) => id !== groupId)
  );
}

export async function markSyncSuccess(): Promise<void> {
  const now = new Date();
  store.set(lastSyncedAtAtom, now);
  await setMetadataValue(LAST_SYNCED_AT_KEY, now.toISOString());
}
