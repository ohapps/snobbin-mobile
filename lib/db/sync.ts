import { db } from './database';
import { getBackendUrl } from '../config';
import { refreshAccessToken } from '../auth';

/**
 * Tracks the last successful sync time. Use getLastSyncedAt() to read.
 */
let _lastSyncedAt: Date | null = null;

export function getLastSyncedAt(): Date | null {
  return _lastSyncedAt;
}

/**
 * Makes an authenticated GET request to the backend API.
 * Returns the parsed JSON response, or throws on failure.
 */
async function apiFetch<T>(path: string): Promise<T> {
  const token = await refreshAccessToken();
  if (!token) {
    throw new Error('No access token available — user may need to re-login');
  }

  const url = `${getBackendUrl()}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} — ${url}`);
  }

  return response.json() as Promise<T>;
}

// ─── Sync Response Types ─────────────────────────────────────────────────────

interface UserGroupsResponse {
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    min_ranking: number;
    max_ranking: number;
    increments: number;
    rank_icon: string | null;
    rankings_required: number;
    deleted: number;
    picture_url: string | null;
  }>;
  memberships: Array<{
    id: string;
    group_id: string;
    snob_id: string;
    role: string;
  }>;
  snobs: Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    picture_url: string | null;
    last_group_id: string | null;
  }>;
}

interface GroupDetailResponse {
  group: {
    id: string;
    name: string;
    description: string | null;
    min_ranking: number;
    max_ranking: number;
    increments: number;
    rank_icon: string | null;
    rankings_required: number;
    deleted: number;
    picture_url: string | null;
  };
  members: Array<{
    id: string;
    group_id: string;
    snob_id: string;
    role: string;
  }>;
  snobs: Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    picture_url: string | null;
    last_group_id: string | null;
  }>;
  attributes: Array<{
    id: string;
    group_id: string;
    name: string;
  }>;
  items: Array<{
    id: string;
    group_id: string;
    description: string;
    ranked: number;
    average_ranking: number | null;
    image_id: string | null;
    image_url: string | null;
    created_date: string | null;
    updated_date: string | null;
    created_by: string | null;
    updated_by: string | null;
  }>;
  itemAttributes: Array<{
    id: string;
    item_id: string;
    attribute_id: string;
    attribute_value: string;
  }>;
  rankings: Array<{
    id: string;
    item_id: string;
    group_member_id: string;
    ranking: number;
    notes: string | null;
    created_date: string | null;
    updated_date: string | null;
  }>;
}

// ─── Sync Functions ──────────────────────────────────────────────────────────

/**
 * Fetches all groups and associated data for the user, writing to local SQLite.
 * Call on app startup and pull-to-refresh.
 */
export async function syncAllUserData(userId: string): Promise<void> {
  try {
    console.log('[Sync] Starting full sync for user:', userId);
    const data = await apiFetch<UserGroupsResponse>(`/api/mobile/user/${userId}/groups`);

    db.execSync('BEGIN TRANSACTION');
    try {
      // Upsert groups
      for (const group of data.groups) {
        db.runSync(
          `INSERT OR REPLACE INTO snob_groups (id, name, description, min_ranking, max_ranking, increments, rank_icon, rankings_required, deleted, picture_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [group.id, group.name, group.description, group.min_ranking, group.max_ranking, group.increments, group.rank_icon, group.rankings_required, group.deleted, group.picture_url]
        );
      }

      // Upsert memberships
      for (const m of data.memberships) {
        db.runSync(
          `INSERT OR REPLACE INTO snob_group_members (id, group_id, snob_id, role)
           VALUES (?, ?, ?, ?)`,
          [m.id, m.group_id, m.snob_id, m.role]
        );
      }

      // Upsert snobs
      for (const s of data.snobs) {
        db.runSync(
          `INSERT OR REPLACE INTO snobs (id, email, first_name, last_name, picture_url, last_group_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [s.id, s.email, s.first_name, s.last_name, s.picture_url, s.last_group_id]
        );
      }

      db.execSync('COMMIT');
    } catch (err) {
      db.execSync('ROLLBACK');
      throw err;
    }

    _lastSyncedAt = new Date();
    console.log('[Sync] Full sync complete —', data.groups.length, 'groups');

    // Sync each group's detailed data (items, rankings, attributes)
    for (const group of data.groups) {
      await syncGroup(group.id);
    }
  } catch (err) {
    console.error('[Sync] Full sync failed:', err);
    throw err;
  }
}

/**
 * Fetches all data for a single group and writes to local SQLite.
 */
export async function syncGroup(groupId: string): Promise<void> {
  try {
    console.log('[Sync] Syncing group:', groupId);
    const data = await apiFetch<GroupDetailResponse>(`/api/mobile/groups/${groupId}`);

    db.execSync('BEGIN TRANSACTION');
    try {
      // Upsert group
      db.runSync(
        `INSERT OR REPLACE INTO snob_groups (id, name, description, min_ranking, max_ranking, increments, rank_icon, rankings_required, deleted, picture_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.group.id, data.group.name, data.group.description, data.group.min_ranking, data.group.max_ranking, data.group.increments, data.group.rank_icon, data.group.rankings_required, data.group.deleted, data.group.picture_url]
      );

      // Upsert members
      for (const m of data.members) {
        db.runSync(
          `INSERT OR REPLACE INTO snob_group_members (id, group_id, snob_id, role)
           VALUES (?, ?, ?, ?)`,
          [m.id, m.group_id, m.snob_id, m.role]
        );
      }

      // Upsert snobs
      for (const s of data.snobs) {
        db.runSync(
          `INSERT OR REPLACE INTO snobs (id, email, first_name, last_name, picture_url, last_group_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [s.id, s.email, s.first_name, s.last_name, s.picture_url, s.last_group_id]
        );
      }

      // Upsert attributes
      for (const a of data.attributes) {
        db.runSync(
          `INSERT OR REPLACE INTO snob_group_attributes (id, group_id, name)
           VALUES (?, ?, ?)`,
          [a.id, a.group_id, a.name]
        );
      }

      // Upsert items
      for (const item of data.items) {
        db.runSync(
          `INSERT OR REPLACE INTO ranking_items (id, group_id, description, ranked, average_ranking, image_id, image_url, created_date, updated_date, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, item.group_id, item.description, item.ranked, item.average_ranking, item.image_id, item.image_url, item.created_date, item.updated_date, item.created_by, item.updated_by]
        );
      }

      // Upsert item attributes
      for (const ia of data.itemAttributes) {
        db.runSync(
          `INSERT OR REPLACE INTO ranking_item_attributes (id, item_id, attribute_id, attribute_value)
           VALUES (?, ?, ?, ?)`,
          [ia.id, ia.item_id, ia.attribute_id, ia.attribute_value]
        );
      }

      // Upsert rankings
      for (const r of data.rankings) {
        db.runSync(
          `INSERT OR REPLACE INTO rankings (id, item_id, group_member_id, ranking, notes, created_date, updated_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.item_id, r.group_member_id, r.ranking, r.notes, r.created_date, r.updated_date]
        );
      }

      db.execSync('COMMIT');
    } catch (err) {
      db.execSync('ROLLBACK');
      throw err;
    }

    _lastSyncedAt = new Date();
    console.log('[Sync] Group sync complete:', groupId);
  } catch (err) {
    console.error('[Sync] Group sync failed:', groupId, err);
    throw err;
  }
}
