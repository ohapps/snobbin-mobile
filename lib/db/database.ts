import * as SQLite from 'expo-sqlite';

/**
 * Singleton expo-sqlite database for synced app data.
 * Uses the synchronous API for simple, predictable queries.
 */
export const db = SQLite.openDatabaseSync('snobbin.db');

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS snob_groups (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    min_ranking REAL,
    max_ranking REAL,
    increments REAL,
    rank_icon TEXT,
    rankings_required REAL,
    deleted INTEGER,
    picture_url TEXT
  );

  CREATE TABLE IF NOT EXISTS snobs (
    id TEXT PRIMARY KEY,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    picture_url TEXT,
    last_group_id TEXT,
    is_premium INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS snob_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    snob_id TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS snob_group_invites (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    email TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS snob_group_attributes (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS ranking_items (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    description TEXT,
    ranked INTEGER,
    average_ranking REAL,
    image_id TEXT,
    image_url TEXT,
    created_date TEXT,
    updated_date TEXT,
    created_by TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS ranking_item_attributes (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    attribute_id TEXT,
    attribute_value TEXT
  );

  CREATE TABLE IF NOT EXISTS rankings (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    group_member_id TEXT,
    ranking REAL,
    notes TEXT,
    created_date TEXT,
    updated_date TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_snob_group_members_group_id ON snob_group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_snob_group_members_snob_id ON snob_group_members(snob_id);
  CREATE INDEX IF NOT EXISTS idx_ranking_items_group_id ON ranking_items(group_id);
  CREATE INDEX IF NOT EXISTS idx_ranking_item_attributes_item_id ON ranking_item_attributes(item_id);
  CREATE INDEX IF NOT EXISTS idx_ranking_item_attributes_attribute_id ON ranking_item_attributes(attribute_id);
  CREATE INDEX IF NOT EXISTS idx_rankings_item_id ON rankings(item_id);
  CREATE INDEX IF NOT EXISTS idx_rankings_group_member_id ON rankings(group_member_id);
`;

const DROP_TABLES_SQL = `
  DROP TABLE IF EXISTS rankings;
  DROP TABLE IF EXISTS ranking_item_attributes;
  DROP TABLE IF EXISTS ranking_items;
  DROP TABLE IF EXISTS snob_group_attributes;
  DROP TABLE IF EXISTS snob_group_invites;
  DROP TABLE IF EXISTS snob_group_members;
  DROP TABLE IF EXISTS snobs;
  DROP TABLE IF EXISTS snob_groups;
`;

/**
 * Initializes the database by creating all tables and indexes.
 * Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS.
 */
export function initDatabase(): void {
  db.execSync(CREATE_TABLES_SQL);
  try {
    db.execSync('ALTER TABLE snobs ADD COLUMN is_premium INTEGER DEFAULT 0;');
  } catch {
    // Column already exists
  }
  console.log('[DB] Database initialized');
}

/**
 * Drops all tables and re-creates them. Used on logout to clear synced data.
 */
export function clearDatabase(): void {
  db.execSync(DROP_TABLES_SQL);
  db.execSync(CREATE_TABLES_SQL);
  console.log('[DB] Database cleared and re-created');
}
