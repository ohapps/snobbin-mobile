/**
 * Domain models for Snobbin — typed representations of the synced database entities.
 * These use camelCase property names (mapped from snake_case DB columns in queries.ts).
 */

export interface SnobGroup {
  id: string;
  name: string;
  description: string;
  minRanking: number;
  maxRanking: number;
  increments: number;
  rankIcon: string;
  rankingsRequired: number;
  deleted: boolean;
  pictureUrl: string | null;
}

export interface Snob {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  pictureUrl: string | null;
  lastGroupId: string | null;
  isPremium: boolean;
}

export interface GroupMember {
  id: string;
  groupId: string;
  snobId: string;
  role: 'ADMIN' | 'MEMBER' | 'DISABLED';
}

export interface GroupInvite {
  id: string;
  groupId: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface GroupAttribute {
  id: string;
  groupId: string;
  name: string;
}

export interface RankingItem {
  id: string;
  groupId: string;
  description: string;
  ranked: boolean;
  averageRanking: number | null;
  imageId: string | null;
  imageUrl: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface RankingItemAttribute {
  id: string;
  itemId: string;
  attributeId: string;
  attributeValue: string;
  attributeName: string;
}

export interface Ranking {
  id: string;
  itemId: string;
  groupMemberId: string;
  ranking: number;
  notes: string | null;
  createdDate: string | null;
  updatedDate: string | null;
}
