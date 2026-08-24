import { db } from './database';
import type { SQLiteBindParams } from 'expo-sqlite';
import type {
  SnobGroup,
  Snob,
  GroupMember,
  RankingItem,
  RankingItemAttribute,
  Ranking,
  GroupAttribute,
} from '../../types/models';

/**
 * All queries hit the local expo-sqlite database.
 * Data is available offline — no network requests happen here.
 * Functions are async to maintain API compatibility with the rest of the app.
 */

// ─── Groups ──────────────────────────────────────────────────────────────────

/**
 * Gets all groups where the current user is an active member.
 * Joins through snob_group_members to find the user's groups.
 */
export async function getUserGroups(userId: string): Promise<SnobGroup[]> {
  const rows = db.getAllSync<{
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
  }>(
    `SELECT g.* FROM snob_groups g
     INNER JOIN snob_group_members m ON m.group_id = g.id
     WHERE m.snob_id = ? AND m.role != 'DISABLED' AND (g.deleted = 0 OR g.deleted IS NULL)
     ORDER BY g.name`,
    [userId]
  );

  return rows.map(mapGroup);
}

/**
 * Gets a single group by ID.
 */
export async function getGroup(groupId: string): Promise<SnobGroup | null> {
  const row = db.getFirstSync<{
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
  }>('SELECT * FROM snob_groups WHERE id = ?', [groupId]);

  return row ? mapGroup(row) : null;
}

/**
 * Gets the member count for a group.
 */
export async function getGroupMemberCount(groupId: string): Promise<number> {
  const result = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM snob_group_members WHERE group_id = ? AND role != 'DISABLED'",
    [groupId]
  );
  return result?.count ?? 0;
}

/**
 * Gets the item count for a group.
 */
export async function getGroupItemCount(groupId: string): Promise<number> {
  const result = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ranking_items WHERE group_id = ?',
    [groupId]
  );
  return result?.count ?? 0;
}

// ─── Members ─────────────────────────────────────────────────────────────────

/**
 * Gets all active members of a group with their snob profile info.
 */
export async function getGroupMembers(groupId: string): Promise<(GroupMember & { snob: Snob })[]> {
  const rows = db.getAllSync<{
    id: string;
    group_id: string;
    snob_id: string;
    role: string;
    s_email: string | null;
    s_first_name: string | null;
    s_last_name: string | null;
    s_picture_url: string | null;
    s_is_premium: number | null;
  }>(
    `SELECT m.id, m.group_id, m.snob_id, m.role,
            s.email as s_email, s.first_name as s_first_name,
            s.last_name as s_last_name, s.picture_url as s_picture_url,
            s.is_premium as s_is_premium
     FROM snob_group_members m
     LEFT JOIN snobs s ON s.id = m.snob_id
     WHERE m.group_id = ? AND m.role != 'DISABLED'
     ORDER BY s.first_name`,
    [groupId]
  );

  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    snobId: row.snob_id,
    role: row.role as 'ADMIN' | 'MEMBER' | 'DISABLED',
    snob: {
      id: row.snob_id,
      email: row.s_email || '',
      firstName: row.s_first_name || '',
      lastName: row.s_last_name || '',
      pictureUrl: row.s_picture_url || null,
      lastGroupId: null,
      isPremium: row.s_is_premium === 1,
    },
  }));
}

/**
 * Gets the current user's membership in a group.
 */
export async function getUserMembership(
  groupId: string,
  userId: string
): Promise<GroupMember | null> {
  const row = db.getFirstSync<{
    id: string;
    group_id: string;
    snob_id: string;
    role: string;
  }>('SELECT * FROM snob_group_members WHERE group_id = ? AND snob_id = ?', [groupId, userId]);

  if (!row) return null;

  return {
    id: row.id,
    groupId: row.group_id,
    snobId: row.snob_id,
    role: row.role as 'ADMIN' | 'MEMBER' | 'DISABLED',
  };
}

// ─── Items ───────────────────────────────────────────────────────────────────

/**
 * Gets all items in a group, ordered by description.
 */
export async function getGroupItems(
  groupId: string,
  sortBy: 'description' | 'rating' | 'recent' = 'description'
): Promise<RankingItem[]> {
  let orderClause: string;
  switch (sortBy) {
    case 'rating':
      orderClause = 'ORDER BY ri.average_ranking DESC NULLS LAST, ri.description';
      break;
    case 'recent':
      orderClause = 'ORDER BY ri.updated_date DESC NULLS LAST, ri.created_date DESC';
      break;
    default:
      orderClause = 'ORDER BY ri.description';
  }

  const rows = db.getAllSync<{
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
  }>(`SELECT ri.* FROM ranking_items ri WHERE ri.group_id = ? ${orderClause}`, [groupId]);

  return rows.map(mapItem);
}

/**
 * Gets a single item by ID.
 */
export async function getItem(itemId: string): Promise<RankingItem | null> {
  const row = db.getFirstSync<{
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
  }>('SELECT * FROM ranking_items WHERE id = ?', [itemId]);

  return row ? mapItem(row) : null;
}

// ─── Attributes ──────────────────────────────────────────────────────────────

/**
 * Gets all attribute definitions for a group.
 */
export async function getGroupAttributes(groupId: string): Promise<GroupAttribute[]> {
  const rows = db.getAllSync<{
    id: string;
    group_id: string;
    name: string;
  }>('SELECT * FROM snob_group_attributes WHERE group_id = ? ORDER BY name', [groupId]);

  return rows.map((r) => ({ id: r.id, groupId: r.group_id, name: r.name }));
}

/**
 * Gets all attribute values for an item, joined with the attribute name.
 */
export async function getItemAttributes(itemId: string): Promise<RankingItemAttribute[]> {
  const rows = db.getAllSync<{
    id: string;
    item_id: string;
    attribute_id: string;
    attribute_value: string;
    attr_name: string | null;
  }>(
    `SELECT ria.*, a.name as attr_name
     FROM ranking_item_attributes ria
     LEFT JOIN snob_group_attributes a ON a.id = ria.attribute_id
     WHERE ria.item_id = ?
     ORDER BY a.name`,
    [itemId]
  );

  const mapped = rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    attributeId: r.attribute_id,
    attributeValue: r.attribute_value,
    attributeName: r.attr_name || '',
  }));

  return Array.from(
    new Map(
      mapped.map((attr) => [
        `${attr.attributeName || attr.attributeId}:${attr.attributeValue}`,
        attr,
      ])
    ).values()
  );
}

// ─── Rankings ────────────────────────────────────────────────────────────────

/**
 * Gets all rankings for an item, joined with member/snob info for display names.
 */
export async function getItemRankings(itemId: string): Promise<(Ranking & { memberName: string })[]> {
  const rows = db.getAllSync<{
    id: string;
    item_id: string;
    group_member_id: string;
    ranking: number;
    notes: string | null;
    created_date: string | null;
    updated_date: string | null;
    first_name: string | null;
    last_name: string | null;
  }>(
    `SELECT r.*, s.first_name, s.last_name
     FROM rankings r
     LEFT JOIN snob_group_members m ON m.id = r.group_member_id
     LEFT JOIN snobs s ON s.id = m.snob_id
     WHERE r.item_id = ?
     ORDER BY r.ranking DESC`,
    [itemId]
  );

  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    groupMemberId: r.group_member_id,
    ranking: r.ranking,
    notes: r.notes || null,
    createdDate: r.created_date || null,
    updatedDate: r.updated_date || null,
    memberName: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown',
  }));
}

/**
 * Gets the current user's ranking for an item (if any).
 */
export async function getUserRankingForItem(
  itemId: string,
  memberId: string
): Promise<Ranking | null> {
  const row = db.getFirstSync<{
    id: string;
    item_id: string;
    group_member_id: string;
    ranking: number;
    notes: string | null;
    created_date: string | null;
    updated_date: string | null;
  }>('SELECT * FROM rankings WHERE item_id = ? AND group_member_id = ?', [itemId, memberId]);

  if (!row) return null;

  return {
    id: row.id,
    itemId: row.item_id,
    groupMemberId: row.group_member_id,
    ranking: row.ranking,
    notes: row.notes || null,
    createdDate: row.created_date || null,
    updatedDate: row.updated_date || null,
  };
}

// ─── Snob Profile ────────────────────────────────────────────────────────────

/**
 * Gets the current user's snob profile.
 */
export async function getSnobProfile(userId: string): Promise<Snob | null> {
  const row = db.getFirstSync<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    picture_url: string | null;
    last_group_id: string | null;
    is_premium: number | null;
  }>('SELECT * FROM snobs WHERE id = ?', [userId]);

  if (!row) return null;

  return {
    id: row.id,
    email: row.email || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    pictureUrl: row.picture_url || null,
    lastGroupId: row.last_group_id || null,
    isPremium: row.is_premium === 1,
  };
}

// ─── Write Operations ────────────────────────────────────────────────────────

/**
 * Executes a write SQL statement (INSERT, UPDATE, DELETE).
 * Returns the number of rows affected.
 */
export async function executeSQL(sql: string, params: SQLiteBindParams = []): Promise<{ rowsAffected: number }> {
  const result = db.runSync(sql, params);
  return { rowsAffected: result.changes };
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapGroup(row: {
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
}): SnobGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    minRanking: row.min_ranking,
    maxRanking: row.max_ranking,
    increments: row.increments,
    rankIcon: row.rank_icon || 'star',
    rankingsRequired: row.rankings_required,
    deleted: row.deleted === 1,
    pictureUrl: row.picture_url || null,
  };
}

function mapItem(row: {
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
}): RankingItem {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    ranked: row.ranked === 1,
    averageRanking: row.average_ranking ?? null,
    imageId: row.image_id || null,
    imageUrl: row.image_url || null,
    createdDate: row.created_date || null,
    updatedDate: row.updated_date || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
  };
}

// ─── Attribute Autocomplete ──────────────────────────────────────────────────

/**
 * Gets all distinct values for a specific attribute within a group.
 * Used for autocomplete suggestions when adding new items.
 */
export async function getDistinctAttributeValues(
  groupId: string,
  attributeId: string
): Promise<string[]> {
  const rows = db.getAllSync<{ attribute_value: string }>(
    `SELECT DISTINCT ria.attribute_value
     FROM ranking_item_attributes ria
     INNER JOIN ranking_items ri ON ri.id = ria.item_id
     WHERE ri.group_id = ? AND ria.attribute_id = ?
     ORDER BY ria.attribute_value`,
    [groupId, attributeId]
  );
  return rows.map((r) => r.attribute_value);
}
