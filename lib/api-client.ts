import { getBackendUrl } from './config';
import { refreshAccessToken } from './auth';

/**
 * API client for write operations.
 * All writes go to the backend first, then local SQLite is refreshed via sync.
 * If offline, writes will fail — the app is read-only when offline.
 */

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await refreshAccessToken();
  if (!token) {
    throw new Error('Not authenticated — please sign in again');
  }

  const url = `${getBackendUrl()}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API write failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const token = await refreshAccessToken();
  if (!token) {
    throw new Error('Not authenticated — please sign in again');
  }

  const url = `${getBackendUrl()}${path}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API delete failed (${response.status}): ${text}`);
  }
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const token = await refreshAccessToken();
  if (!token) {
    throw new Error('Not authenticated — please sign in again');
  }

  const url = `${getBackendUrl()}${path}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API write failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

// ─── Item Operations ─────────────────────────────────────────────────────────

export interface CreateItemPayload {
  groupId: string;
  description: string;
  imageId: string | null;
  imageUrl: string | null;
  attributes: Array<{ attributeId: string; attributeValue: string }>;
}

/**
 * Creates a new ranking item on the backend.
 * Returns the created item's ID.
 */
export async function createItem(payload: CreateItemPayload): Promise<{ id: string }> {
  return apiPost('/api/mobile/items', payload);
}

export interface UpdateItemPayload {
  id: string;
  description: string;
  imageId: string | null;
  imageUrl: string | null;
  attributes: Array<{ attributeId: string; attributeValue: string }>;
}

/**
 * Updates an existing ranking item on the backend.
 */
export async function updateItem(payload: UpdateItemPayload): Promise<{ id: string }> {
  return apiPut(`/api/mobile/items/${payload.id}`, payload);
}

// ─── Ranking Operations ──────────────────────────────────────────────────────

export interface SaveRankingPayload {
  id?: string;
  itemId: string;
  groupMemberId: string;
  ranking: number;
  notes: string | null;
}

/**
 * Creates or updates a ranking on the backend.
 * Returns the ranking ID.
 */
export async function saveRanking(payload: SaveRankingPayload): Promise<{ id: string }> {
  return apiPost('/api/mobile/rankings', payload);
}

// ─── Delete Operations ───────────────────────────────────────────────────────

/**
 * Deletes a ranking item on the backend.
 * Only ADMIN members of the group can delete items.
 * Associated rankings and attributes are cascade-deleted.
 */
export async function deleteItem(itemId: string): Promise<void> {
  return apiDelete(`/api/mobile/items/${itemId}`);
}
