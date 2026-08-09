import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Banner } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAtomValue } from 'jotai';
import { lastSyncedAtAtom, syncStatusAtom } from '../store/atoms';

/**
 * Shows sync progress on startup/refresh, or an offline warning only when
 * sync has genuinely failed — not while a connection is still being established.
 */
export default function SyncStatus() {
  const syncStatus = useAtomValue(syncStatusAtom);
  const lastSynced = useAtomValue(lastSyncedAtAtom);
  const [dismissed, setDismissed] = useState(false);

  if (syncStatus === 'syncing') {
    return (
      <Banner
        visible
        style={styles.syncingBanner}
        icon={({ size }) => (
          <MaterialCommunityIcons name="cloud-sync-outline" size={size} color="#1565c0" />
        )}
      >
        Syncing data...
      </Banner>
    );
  }

  if (syncStatus === 'error' && !dismissed) {
    return (
      <Banner
        visible
        style={styles.offlineBanner}
        icon={({ size }) => (
          <MaterialCommunityIcons name="cloud-off-outline" size={size} color="#1a1c1e" />
        )}
        actions={[
          { label: 'Dismiss', onPress: () => setDismissed(true) },
        ]}
      >
        {lastSynced
          ? "Couldn't reach the server. Showing your saved data — pull to refresh to try again."
          : 'Working offline. Pull to refresh to sync data.'}
      </Banner>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  syncingBanner: {
    backgroundColor: '#E3F2FD',
  },
  offlineBanner: {
    backgroundColor: '#FFF3E0',
  },
});
