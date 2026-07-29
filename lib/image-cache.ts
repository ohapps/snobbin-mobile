import { Paths, File, Directory } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const CACHE_DIR = new Directory(Paths.document, 'image-cache');

/**
 * Ensures the image cache directory exists.
 */
function ensureCacheDir(): void {
  if (!CACHE_DIR.exists) {
    CACHE_DIR.create({ intermediates: true });
  }
}

/**
 * Generates a deterministic local filename from a URL using SHA-256 hash.
 * This ensures the same URL always maps to the same cached file.
 */
async function getCacheFilename(url: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );
  // Preserve the file extension from the URL if present
  const extensionMatch = url.match(/\.(jpg|jpeg|png|gif|webp|avif)/i);
  const extension = extensionMatch ? extensionMatch[0] : '.jpg';
  return `${hash}${extension}`;
}

/**
 * Returns the local file URI for a cached image.
 * If the image is not cached, downloads it first.
 * Returns the original URL as fallback if download fails (for online use).
 */
export async function getCachedImageUri(remoteUrl: string): Promise<string> {
  if (!remoteUrl) return '';

  try {
    ensureCacheDir();
    const filename = await getCacheFilename(remoteUrl);
    const cachedFile = new File(CACHE_DIR, filename);

    // Check if already cached
    if (cachedFile.exists) {
      return cachedFile.uri;
    }

    // Download and cache
    const downloadedFile = await File.downloadFileAsync(remoteUrl, cachedFile, {
      idempotent: true,
    });
    return downloadedFile.uri;
  } catch {
    // Network error or filesystem error — return remote URL as fallback
    return remoteUrl;
  }
}

/**
 * Checks if an image is already cached locally.
 */
export async function isImageCached(remoteUrl: string): Promise<boolean> {
  if (!remoteUrl) return false;

  try {
    ensureCacheDir();
    const filename = await getCacheFilename(remoteUrl);
    const cachedFile = new File(CACHE_DIR, filename);
    return cachedFile.exists;
  } catch {
    return false;
  }
}

/**
 * Clears the entire image cache. Used from the profile screen.
 */
export async function clearImageCache(): Promise<void> {
  try {
    if (CACHE_DIR.exists) {
      CACHE_DIR.delete();
    }
  } catch {
    // Silently fail — cache will be recreated on next access
  }
}

/**
 * Returns the total size of the image cache in bytes.
 */
export async function getImageCacheSize(): Promise<number> {
  try {
    if (!CACHE_DIR.exists) return 0;

    const entries = CACHE_DIR.list();
    let totalSize = 0;

    for (const entry of entries) {
      if (entry instanceof File) {
        totalSize += entry.size ?? 0;
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}
