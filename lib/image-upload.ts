import * as ImagePicker from 'expo-image-picker';
import { getBackendUrl } from './config';
import { refreshAccessToken } from './auth';

/**
 * Cloudinary cloud name — must match the web app's NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.
 * This is a public identifier, safe to embed in client code.
 */
const CLOUDINARY_CLOUD_NAME = 'dwv9pbgzh';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export interface UploadedImage {
  publicId: string;
  url: string;
}

/**
 * Opens the device image picker (photo library or camera).
 * Returns the local URI of the selected image, or null if cancelled.
 */
export async function pickImage(useCamera = false): Promise<string | null> {
  // Request permissions
  if (useCamera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImageUpload] Camera permission denied');
      return null;
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImageUpload] Media library permission denied');
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    ...(useCamera && { mediaTypes: ['images'] }),
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Takes a photo with the camera.
 * Returns the local URI of the captured image, or null if cancelled.
 */
export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[ImageUpload] Camera permission denied');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Uploads an image to Cloudinary using signed upload.
 *
 * Flow:
 * 1. Request a signature from the backend (POST /api/sign-image)
 * 2. Upload the image directly to Cloudinary with the signature
 * 3. Return the public ID and secure URL
 */
export async function uploadImage(localUri: string): Promise<UploadedImage> {
  // Step 1: Get upload signature from backend
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramsToSign = { timestamp, folder: 'snobbin' };

  const token = await refreshAccessToken();
  const backendUrl = getBackendUrl();

  const signResponse = await fetch(`${backendUrl}/api/sign-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ paramsToSign }),
  });

  if (!signResponse.ok) {
    throw new Error(`Failed to get upload signature: ${signResponse.status}`);
  }

  const { signature } = await signResponse.json();

  // Step 2: Upload to Cloudinary
  const formData = new FormData();
  const filename = localUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('file', {
    uri: localUri,
    name: filename,
    type,
  } as any);
  formData.append('timestamp', timestamp);
  formData.append('folder', 'snobbin');
  formData.append('signature', signature);
  formData.append('api_key', await getApiKey());

  const uploadResponse = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Cloudinary upload failed: ${error}`);
  }

  const data = await uploadResponse.json();

  return {
    publicId: data.public_id,
    url: data.secure_url,
  };
}

/**
 * Gets the Cloudinary API key from the backend.
 * This avoids hardcoding it in the mobile app bundle.
 */
let _cachedApiKey: string | null = null;

async function getApiKey(): Promise<string> {
  if (_cachedApiKey) return _cachedApiKey;

  // The API key is public (used for unsigned/signed uploads alongside a signature).
  // We could hardcode it, but fetching from backend keeps it in one place.
  // For now, hardcode the same key used by the web app.
  _cachedApiKey = '275261746522277';
  return _cachedApiKey;
}
