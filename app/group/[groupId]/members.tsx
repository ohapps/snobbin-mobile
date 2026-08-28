import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Chip, Divider, IconButton, List, Menu, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useAtomValue } from 'jotai';
import { authStateAtom } from '../../../store/atoms';
import { getGroupMembers, getUserMembership, syncGroup } from '../../../lib/db';
import { createInvite, getGroupInvites, GroupInvite, updateMemberRole } from '../../../lib/api-client';
import type { GroupMember, Snob } from '../../../types/models';

interface MemberWithSnob extends GroupMember {
  snob: Snob;
}

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const authState = useAtomValue(authStateAtom);

  const [members, setMembers] = useState<MemberWithSnob[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!groupId || !authState.userId) return;

    try {
      const [memberData, membership, inviteData] = await Promise.all([
        getGroupMembers(groupId),
        getUserMembership(groupId, authState.userId),
        getGroupInvites(groupId).catch(() => ({ invites: [] })),
      ]);

      setMembers(memberData as MemberWithSnob[]);
      setIsAdmin(membership?.role === 'ADMIN');
      setInvites(inviteData.invites);
    } catch (err) {
      console.error('[Members] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId, authState.userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendInvite = useCallback(async () => {
    if (!email.trim() || !groupId) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      const invite = await createInvite(groupId, email.trim().toLowerCase());
      setInvites((prev) => [...prev, invite]);
      setEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send invite';
      if (message.includes('409')) {
        Alert.alert('Already Invited', 'An invite for this email already exists.');
      } else {
        Alert.alert('Error', 'Failed to send invite. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }, [email, groupId]);

  const handleMakeAdmin = useCallback((member: MemberWithSnob) => {
    setMenuVisible(null);
    Alert.alert(
      'Make Admin',
      `Are you sure you want to make ${getMemberName(member)} an admin?\n\nAdmin users can modify group settings, manage members, and delete the group.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Make Admin',
          onPress: async () => {
            if (!groupId) return;
            setUpdatingMember(member.id);
            try {
              await updateMemberRole(groupId, member.id, 'ADMIN');
              await syncGroup(groupId);
              await loadData();
            } catch (err) {
              console.error('[Members] Failed to make admin:', err);
              Alert.alert('Error', 'Failed to update member role. Please try again.');
            } finally {
              setUpdatingMember(null);
            }
          },
        },
      ],
    );
  }, [groupId, loadData]);

  const handleDisableMember = useCallback((member: MemberWithSnob) => {
    setMenuVisible(null);
    Alert.alert(
      'Disable Member',
      `Are you sure you want to disable ${getMemberName(member)}?\n\nDisabled members will no longer be able to access the group but their current rankings will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Disable',
          style: 'destructive',
          onPress: async () => {
            if (!groupId) return;
            setUpdatingMember(member.id);
            try {
              await updateMemberRole(groupId, member.id, 'DISABLED');
              await syncGroup(groupId);
              await loadData();
            } catch (err) {
              console.error('[Members] Failed to disable member:', err);
              Alert.alert('Error', 'Failed to disable member. Please try again.');
            } finally {
              setUpdatingMember(null);
            }
          },
        },
      ],
    );
  }, [groupId, loadData]);

  const handleEnableMember = useCallback((member: MemberWithSnob) => {
    setMenuVisible(null);
    Alert.alert(
      'Enable Member',
      `Are you sure you want to enable ${getMemberName(member)}?\n\nEnabling this member will allow them to access the group again and participate in rankings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Enable',
          onPress: async () => {
            if (!groupId) return;
            setUpdatingMember(member.id);
            try {
              await updateMemberRole(groupId, member.id, 'MEMBER');
              await syncGroup(groupId);
              await loadData();
            } catch (err) {
              console.error('[Members] Failed to enable member:', err);
              Alert.alert('Error', 'Failed to enable member. Please try again.');
            } finally {
              setUpdatingMember(null);
            }
          },
        },
      ],
    );
  }, [groupId, loadData]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return '#1565c0';
      case 'DISABLED': return '#9e9e9e';
      default: return '#546e7a';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Members' }} />
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Members' }} />

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* Invite section */}
            {isAdmin && (
              <View style={styles.inviteSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Invite Member
                </Text>
                <View style={styles.inviteRow}>
                  <TextInput
                    label="Email address"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.emailInput}
                    right={
                      <TextInput.Icon
                        icon="send"
                        onPress={handleSendInvite}
                        disabled={sending || !email.trim()}
                      />
                    }
                  />
                </View>

                {/* Pending invites */}
                {invites.length > 0 && (
                  <View style={styles.pendingSection}>
                    <Text variant="bodySmall" style={styles.pendingLabel}>
                      Pending Invites ({invites.length})
                    </Text>
                    {invites.map((invite) => (
                      <Chip
                        key={invite.id}
                        icon="email-outline"
                        compact
                        style={styles.inviteChip}
                        textStyle={styles.inviteChipText}
                      >
                        {invite.email}
                      </Chip>
                    ))}
                  </View>
                )}
                <Divider style={styles.divider} />
              </View>
            )}

            {/* Members header */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Members ({members.length})
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.memberContent}>
              <List.Icon icon="account" style={styles.memberIcon} />
              <View style={styles.memberInfo}>
                <Text variant="bodyLarge" style={styles.memberName}>
                  {getMemberName(item)}
                </Text>
                <Text variant="bodySmall" style={styles.memberEmail}>
                  {item.snob?.email}
                </Text>
                <View style={styles.badgeRow}>
                  <Chip
                    compact
                    style={[styles.roleChip, { borderColor: getRoleColor(item.role) }]}
                    textStyle={[styles.roleChipText, { color: getRoleColor(item.role) }]}
                    mode="outlined"
                  >
                    {item.role}
                  </Chip>
                </View>
              </View>
              {isAdmin && item.role !== 'ADMIN' && item.snobId !== authState.userId && (
                <Menu
                  visible={menuVisible === item.id}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      size={18}
                      onPress={() => setMenuVisible(item.id)}
                      disabled={updatingMember === item.id}
                      loading={updatingMember === item.id}
                      style={styles.menuButton}
                    />
                  }
                >
                  {item.role !== 'DISABLED' && (
                    <Menu.Item
                      leadingIcon="shield-account"
                      onPress={() => handleMakeAdmin(item)}
                      title="Make Admin"
                    />
                  )}
                  {item.role !== 'DISABLED' && (
                    <Menu.Item
                      leadingIcon="account-off"
                      onPress={() => handleDisableMember(item)}
                      title="Disable Member"
                    />
                  )}
                  {item.role === 'DISABLED' && (
                    <Menu.Item
                      leadingIcon="account-check"
                      onPress={() => handleEnableMember(item)}
                      title="Enable Member"
                    />
                  )}
                </Menu>
              )}
            </View>
            <Divider style={styles.memberDivider} />
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function getMemberName(member: MemberWithSnob): string {
  if (member.snob?.firstName || member.snob?.lastName) {
    return `${member.snob.firstName || ''} ${member.snob.lastName || ''}`.trim();
  }
  return member.snob?.email || 'Unknown';
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
  },
  loadingText: {
    color: '#546e7a',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  inviteSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  inviteRow: {
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: '#ffffff',
  },
  pendingSection: {
    marginTop: 8,
    gap: 6,
  },
  pendingLabel: {
    color: '#546e7a',
    marginBottom: 4,
  },
  inviteChip: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  inviteChipText: {
    fontSize: 12,
  },
  divider: {
    marginTop: 16,
    marginBottom: 8,
  },
  memberRow: {
    paddingVertical: 12,
  },
  memberContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberIcon: {
    marginRight: 4,
    marginTop: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontWeight: '500',
  },
  memberEmail: {
    color: '#546e7a',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  menuButton: {
    margin: 0,
    marginLeft: 4,
  },
  memberDivider: {
    marginTop: 12,
    backgroundColor: '#c8dce8',
  },
  roleChip: {
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  roleChipText: {
    fontSize: 10,
    marginVertical: 2,
  },
});
