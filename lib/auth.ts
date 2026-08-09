import * as AuthSession from 'expo-auth-session';
import * as SQLite from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Replace with your Auth0 Native Application Client ID
const AUTH0_CLIENT_ID = 'Nm6S7dlgwkjIxOmCbbbI4jB1zVuGtNIv';
const AUTH0_DOMAIN = 'dev--hkrho7z.us.auth0.com';

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'snobbin',
  path: 'auth/callback',
});

const discovery = {
  authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
  userInfoEndpoint: `https://${AUTH0_DOMAIN}/userinfo`,
};

const DATABASE_NAME = 'snobbin_metadata.db';

export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  pictureUrl: string | null;
  isLoggedIn: boolean;
}

let dbInitialized = false;

/**
 * Opens the local metadata SQLite database and ensures the app_metadata table exists.
 * This is separate from the main database — it stores auth tokens and user profile locally.
 */
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  if (!dbInitialized) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    dbInitialized = true;
  }
  return db;
}

/**
 * Retrieves stored auth state from local SQLite.
 * Used on app startup to determine if the user is logged in without hitting the network.
 */
export async function getStoredAuth(): Promise<AuthState> {
  const db = await getDb();

  const token = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_refresh_token'"
  );
  const userId = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_user_id'"
  );
  const email = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_email'"
  );
  const firstName = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_first_name'"
  );
  const lastName = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_last_name'"
  );
  const pictureUrl = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_picture_url'"
  );

  if (token && userId) {
    return {
      accessToken: null,
      userId: userId.value,
      email: email?.value || null,
      firstName: firstName?.value || null,
      lastName: lastName?.value || null,
      pictureUrl: pictureUrl?.value || null,
      isLoggedIn: true,
    };
  }
  return {
    accessToken: null,
    userId: null,
    email: null,
    firstName: null,
    lastName: null,
    pictureUrl: null,
    isLoggedIn: false,
  };
}

/**
 * Initiates Auth0 login with PKCE flow.
 * On success, stores the refresh token, user ID (Auth0 sub), and profile info locally.
 * The Auth0 `sub` value is used as the snobs.id in the database.
 */
export async function login(): Promise<AuthState> {
  const request = new AuthSession.AuthRequest({
    clientId: AUTH0_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
    },
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Login cancelled or failed');
  }

  // Exchange authorization code for tokens
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: AUTH0_CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier! },
    },
    discovery
  );

  // Fetch user profile from Auth0
  const userInfoResponse = await fetch(discovery.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
  });
  const userInfo = await userInfoResponse.json();
  const userId = userInfo.sub as string;

  // Persist auth state to local SQLite
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_refresh_token', ?)",
    [tokenResult.refreshToken || '']
  );
  await db.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_user_id', ?)",
    [userId]
  );
  await db.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_email', ?)",
    [userInfo.email || '']
  );
  await db.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_first_name', ?)",
    [userInfo.given_name || '']
  );
  await db.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_last_name', ?)",
    [userInfo.family_name || '']
  );
  await db.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_picture_url', ?)",
    [userInfo.picture || '']
  );

  return {
    accessToken: tokenResult.accessToken,
    userId,
    email: userInfo.email || null,
    firstName: userInfo.given_name || null,
    lastName: userInfo.family_name || null,
    pictureUrl: userInfo.picture || null,
    isLoggedIn: true,
  };
}

/**
 * Uses the stored refresh token to get a fresh access token.
 * Returns null if no refresh token is stored or if the refresh fails (e.g., offline).
 */
export async function refreshAccessToken(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_refresh_token'"
  );

  if (!row?.value) return null;

  try {
    const tokenResult = await AuthSession.refreshAsync(
      { clientId: AUTH0_CLIENT_ID, refreshToken: row.value },
      discovery
    );

    // Update stored refresh token if rotated
    if (tokenResult.refreshToken && tokenResult.refreshToken !== row.value) {
      await db.runAsync(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth0_refresh_token', ?)",
        [tokenResult.refreshToken]
      );
    }

    return tokenResult.accessToken;
  } catch {
    return null;
  }
}

/**
 * Logs out by revoking the refresh token on Auth0 and clearing local auth state.
 */
export async function logout(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_refresh_token'"
  );

  // Revoke refresh token on Auth0 server (best-effort)
  if (row?.value) {
    await fetch(discovery.revocationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${AUTH0_CLIENT_ID}&token=${row.value}&token_type_hint=refresh_token`,
    }).catch(() => {}); // Clear local state regardless
  }

  await db.runAsync(
    "DELETE FROM app_metadata WHERE key IN ('auth0_refresh_token', 'auth0_user_id', 'auth0_email', 'auth0_first_name', 'auth0_last_name', 'auth0_picture_url')"
  );
}

/**
 * Reads a value from the local metadata store.
 */
export async function getMetadataValue(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

/**
 * Writes a value to the local metadata store.
 */
export async function setMetadataValue(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    [key, value]
  );
}

/**
 * Removes a value from the local metadata store.
 */
export async function deleteMetadataValue(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM app_metadata WHERE key = ?', [key]);
}

/**
 * Returns the stored Auth0 user ID (sub), which maps to snobs.id in the database.
 */
export async function getAuthUserId(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'auth0_user_id'"
  );
  return row?.value || null;
}
