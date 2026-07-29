import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle, type ImageStyle, type StyleProp } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Image, type ImageContentFit } from 'expo-image';
import { getCachedImageUri } from '../lib/image-cache';

interface CachedImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
}

/**
 * Image component with offline caching.
 * On first load, downloads the image to local filesystem via image-cache.ts.
 * On subsequent loads, serves from local cache — works fully offline.
 */
export default function CachedImage({ uri, style, contentFit = 'cover' }: CachedImageProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (!uri) {
        setLoading(false);
        return;
      }

      try {
        const cached = await getCachedImageUri(uri);
        if (!cancelled) {
          setLocalUri(cached);
        }
      } catch {
        // Fallback to remote URI if caching fails
        if (!cancelled) {
          setLocalUri(uri);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!uri) return null;

  if (loading) {
    return (
      <View style={[styles.placeholder, style as StyleProp<ViewStyle>]}>
        <ActivityIndicator size="small" color="#1976d2" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: localUri || uri }}
      style={style}
      contentFit={contentFit}
      transition={200}
      cachePolicy="memory-disk"
      accessibilityLabel="Item image"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#bbdefb',
  },
});
