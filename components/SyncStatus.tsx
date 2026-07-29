import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Banner } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLastSyncedAt } from '../lib/db';

/**
 * Displays a banner showing the last sync time, or a warning if never synced.
 * Polls the sync state every few seconds to stay current.
 */
export default function SyncStatus() {
  const [lastSynced, setLastSynced] = useState<Date | null>(getLastSyncedAt());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Poll sync status every 5 seconds
    const interval = setInterval(() => {
      setLastSynced(getLastSyncedAt());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Don't show if synced recently or user dismissed
  if (lastSynced || dismissed) return null;

  return (
    <Banner
      visible
      style={styles.banner}
      icon={({ size }) => (
        <MaterialCommunityIcons name="cloud-off-outline" size={size} color="#1a1c1e" />
      )}
      actions={[
        { label: 'Dismiss', onPress: () => setDismissed(true) },
      ]}
    >
      Working offline. Pull to refresh to sync data.
    </Banner>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3E0',
  },
});
