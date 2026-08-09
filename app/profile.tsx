import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { Avatar, Button, Divider, List, Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAtom, useAtomValue } from 'jotai';
import { authStateAtom, lastSyncedAtAtom, syncStatusAtom } from '../store/atoms';
import { logout } from '../lib/auth';
import { getSnobProfile, clearDatabase } from '../lib/db';
import { clearSyncState } from '../lib/sync-state';
import { clearImageCache, getImageCacheSize } from '../lib/image-cache';
import type { Snob } from '../types/models';

export default function ProfileScreen() {
  const [authState, setAuthState] = useAtom(authStateAtom);
  const lastSyncedAt = useAtomValue(lastSyncedAtAtom);
  const syncStatus = useAtomValue(syncStatusAtom);
  const [profile, setProfile] = useState<Snob | null>(null);
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      if (authState.userId) {
        const snob = await getSnobProfile(authState.userId);
        setProfile(snob);
      }
      const bytes = await getImageCacheSize();
      setCacheSize(formatBytes(bytes));
    }
    load();
  }, [authState.userId]);

  const handleLogout = useCallback(async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            clearDatabase();
            await clearSyncState();
            await logout();
            setAuthState({
              accessToken: null,
              userId: null,
              email: null,
              firstName: null,
              lastName: null,
              pictureUrl: null,
              isLoggedIn: false,
            });
            router.replace('/login');
          } catch (err) {
            console.error('Logout failed:', err);
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, []);

  const handleClearCache = useCallback(async () => {
    await clearImageCache();
    setCacheSize(formatBytes(0));
  }, []);

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : authState.firstName
      ? `${authState.firstName} ${authState.lastName || ''}`.trim()
      : 'User';

  const email = profile?.email || authState.email || '';
  const pictureUrl = profile?.pictureUrl || authState.pictureUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.profileCard} elevation={1}>
        <View style={styles.avatarRow}>
          {pictureUrl ? (
            <Avatar.Image size={72} source={{ uri: pictureUrl }} />
          ) : (
            <Avatar.Text size={72} label={getInitials(displayName)} />
          )}
          <View style={styles.nameColumn}>
            <Text variant="headlineSmall" style={styles.name}>
              {displayName}
            </Text>
            <Text variant="bodyMedium" style={styles.email}>
              {email}
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={styles.section} elevation={1}>
        <List.Section>
          <List.Subheader>Storage</List.Subheader>
          <List.Item
            title="Image Cache"
            description={cacheSize}
            left={(props) => <List.Icon {...props} icon="image-multiple" />}
            right={() => (
              <Button mode="text" onPress={handleClearCache} compact>
                Clear
              </Button>
            )}
          />
        </List.Section>
      </Surface>

      <Surface style={styles.section} elevation={1}>
        <List.Section>
          <List.Subheader>Sync</List.Subheader>
          <List.Item
            title="Data Status"
            description={
              syncStatus === 'syncing'
                ? 'Syncing...'
                : lastSyncedAt
                  ? `Last synced: ${lastSyncedAt.toLocaleString()}`
                  : 'Not yet synced'
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon={
                  syncStatus === 'syncing'
                    ? 'cloud-sync'
                    : lastSyncedAt
                      ? 'cloud-check'
                      : 'cloud-off-outline'
                }
              />
            )}
          />
        </List.Section>
      </Surface>

      <Divider style={styles.divider} />

      <Button
        mode="outlined"
        onPress={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
        style={styles.logoutButton}
        textColor="#B3261E"
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dfeffa',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nameColumn: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
  },
  email: {
    color: '#1a1c1e',
    marginTop: 4,
  },
  section: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  divider: {
    marginVertical: 16,
  },
  logoutButton: {
    borderColor: '#B3261E',
  },
});
