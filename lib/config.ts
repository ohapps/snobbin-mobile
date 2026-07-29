import Constants from 'expo-constants';

/**
 * Backend URL for the Snobbin API.
 * In dev, derives the host from Expo's hostUri (your machine's IP).
 * In prod, points to the deployed Vercel app.
 */
export function getBackendUrl(): string {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3000`;
    }
    return 'http://localhost:3000';
  }
  return 'https://snobbin.vercel.app';
}
