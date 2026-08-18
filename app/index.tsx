import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Redirect, useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import { useFocusEffect } from '@react-navigation/native';
import { authStateAtom, appReadyAtom } from '../store/atoms';
import { getUserGroups, getGroupMemberCount, getGroupItemCount, getSnobProfile, syncAllUserData } from '../lib/db';
import type { SnobGroup } from '../types/models';
import GroupCard from '../components/GroupCard';
import SyncStatus from '../components/SyncStatus';
import EmptyState from '../components/EmptyState';

interface GroupWithCounts extends SnobGroup {
  memberCount: number;
  itemCount: number;
}

export default function HomeScreen() {
  const authState = useAtomValue(authStateAtom);
  const appReady = useAtomValue(appReadyAtom);
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithCounts[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasAutoNavigated = useRef(false);

  // Redirect to login if not authenticated (once app initialization is done)
  if (appReady && !authState.isLoggedIn) {
    return <Redirect href="/login" />;
  }

  const loadGroups = useCallback(async () => {
    if (!authState.userId) {
      setLoading(false);
      return;
    }

    try {
      const userGroups = await getUserGroups(authState.userId);

      // Fetch counts for each group in parallel
      const groupsWithCounts = await Promise.all(
        userGroups.map(async (group) => {
          const [memberCount, itemCount] = await Promise.all([
            getGroupMemberCount(group.id),
            getGroupItemCount(group.id),
          ]);
          return { ...group, memberCount, itemCount };
        })
      );

      setGroups(groupsWithCounts);

      // Auto-navigate to lastGroupId on first load only
      if (!hasAutoNavigated.current && groupsWithCounts.length > 0) {
        hasAutoNavigated.current = true;
        const profile = await getSnobProfile(authState.userId);
        if (profile?.lastGroupId) {
          const matchingGroup = groupsWithCounts.find((g) => g.id === profile.lastGroupId);
          if (matchingGroup) {
            router.push(`/group/${matchingGroup.id}`);
            return;
          }
        }
      }
    } catch (err) {
      console.error('[HomeScreen] Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  }, [authState.userId, router]);

  // Reload data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (authState.userId) {
        await syncAllUserData(authState.userId);
      }
      await loadGroups();
    } catch (err) {
      console.error('[HomeScreen] Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [authState.userId, loadGroups]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text variant="bodyLarge" style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SyncStatus />
      {groups.length === 0 ? (
        <EmptyState
          icon="account-group"
          title="No Groups Yet"
          message="Join or create a group on the web app to get started ranking items with friends."
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              memberCount={item.memberCount}
              itemCount={item.itemCount}
              onPress={() => router.push(`/group/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dfeffa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#546e7a',
  },
  list: {
    padding: 16,
    paddingBottom: 16,
  },
});
