import { StyleSheet } from 'react-native';
import { Banner } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface GroupSyncBannerProps {
  message?: string;
}

/**
 * Inline banner shown while a group's items are being fetched from the API.
 */
export default function GroupSyncBanner({
  message = 'Loading items...',
}: GroupSyncBannerProps) {
  return (
    <Banner
      visible
      style={styles.banner}
      icon={({ size }) => (
        <MaterialCommunityIcons name="cloud-sync-outline" size={size} color="#1565c0" />
      )}
    >
      {message}
    </Banner>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#E3F2FD',
  },
});
