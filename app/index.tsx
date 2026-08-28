import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, ActivityIndicator } from 'react-native';
import { FAB, Text } from 'react-native-paper';
import { Redirect, useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import { useFocusEffect } from '@react-navigation/native';
import { authStateAtom, appReadyAtom, syncStatusAtom, lastSyncedAtAtom } from '../store/atoms';
import { getUserGroups, getGroupMemberCount, getGroupItemCount, getSnobProfile, syncAllUserData } from '../lib/db';
import { getMyInvites, acceptInvite, declineInvite, PendingInvite } from '../lib/api-client';
import type { SnobGroup } from '../types/models';
import GroupCard from '../components/GroupCard';
import InviteCard from '../components/InviteCard';
import SyncStatus from '../components/SyncStatus';
import EmptyState from '../components/EmptyState';

interface GroupWithCounts extends SnobGroup {
  memberCount: number;
  itemCount: number;
}

export default function HomeScreen() {
  const authState = useAtomValue(authStateAtom);
  const appReady = useAtomValue(appReadyAtom);
  const syncStatus = useAtomValue(syncStatusAtom);
  const lastSyncedAt = useAtomValue(lastSyncedAtAtom);
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithCounts[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasAutoNavigated = useRef(false);

  const loadGroups = useCallback(async () => {
    if (!authState.userId) {
      setLoading(false);
      return;
    }

    try {
      const userGroups = await getUserGroups(authState.userId);

      // Fetch counts and invites in parallel
      const [groupsWithCounts, inviteData] = await Promise.all([
        Promise.all(
          userGroups.map(async (group) => {
            const [memberCount, itemCount] = await Promise.all([
              getGroupMemberCount(group.id),
              getGroupItemCount(group.id),
            ]);
            return { ...group, memberCount, itemCount };
          })
        ),
        getMyInvites().catch(() => ({ invites: [] })),
      ]);

      setGroups(groupsWithCounts);
      setInvites(inviteData.invites);

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

  // Reload data on mount or when sync state updates
  useEffect(() => {
    loadGroups();
  }, [loadGroups, syncStatus, lastSyncedAt]);

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

  const handleAcceptInvite = useCallback(async (inviteId: string) => {
    setProcessingInvite(inviteId);
    try {
      const result = await acceptInvite(inviteId);
      // Remove the invite from the list
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      // Sync to pull the new group into local DB
      if (authState.userId) {
        await syncAllUserData(authState.userId);
        await loadGroups();
      }
      // Navigate to the new group
      router.push(`/group/${result.groupId}`);
    } catch (err) {
      console.error('[HomeScreen] Accept invite failed:', err);
    } finally {
      setProcessingInvite(null);
    }
  }, [authState.userId, loadGroups, router]);

  const handleDeclineInvite = useCallback(async (inviteId: string) => {
    setProcessingInvite(inviteId);
    try {
      await declineInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error('[HomeScreen] Decline invite failed:', err);
    } finally {
      setProcessingInvite(null);
    }
  }, []);

  // Redirect to login if not authenticated (once app initialization is done)
  if (appReady && !authState.isLoggedIn) {
    return <Redirect href="/login" />;
  }

  const isInitialSync = groups.length === 0 && syncStatus === 'syncing';

  if (loading || isInitialSync) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text variant="bodyLarge" style={styles.loadingText}>
            {isInitialSync ? 'Syncing your groups...' : 'Loading groups...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SyncStatus />
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
        ListHeaderComponent={
          invites.length > 0 ? (
            <View style={styles.invitesSection}>
              <Text variant="titleSmall" style={styles.invitesTitle}>
                Pending Invites
              </Text>
              {invites.map((invite) => (
                <InviteCard
                  key={invite.id}
                  invite={invite}
                  onAccept={() => handleAcceptInvite(invite.id)}
                  onDecline={() => handleDeclineInvite(invite.id)}
                  accepting={processingInvite === invite.id}
                  declining={processingInvite === invite.id}
                />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          invites.length === 0 ? (
            <EmptyState
              icon="account-group"
              title="No Groups Yet"
              message="Tap the + button to create a group, or join one from the web app."
            />
          ) : null
        }
        contentContainerStyle={groups.length === 0 && invites.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        color="#ffffff"
        onPress={() => router.push('/group/form')}
        accessibilityLabel="Create new group"
      />
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
  emptyList: {
    flexGrow: 1,
    padding: 16,
  },
  invitesSection: {
    marginBottom: 16,
  },
  invitesTitle: {
    color: '#1976d2',
    fontWeight: '600',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1565c0',
    borderRadius: 28,
  },
});
