import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, Alert } from 'react-native';
import { Button, Divider, IconButton, Text, TextInput, Surface, Portal, Modal } from 'react-native-paper';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import * as Crypto from 'expo-crypto';
import { authStateAtom } from '../../../../store/atoms';
import {
  getItem,
  getGroup,
  getGroupAttributes,
  getItemAttributes,
  getItemRankings,
  getUserMembership,
  getUserRankingForItem,
  getDistinctAttributeValues,
  executeSQL,
  syncGroup,
} from '../../../../lib/db';
import { saveRanking, updateItem, deleteItem } from '../../../../lib/api-client';
import { pickImage, takePhoto, uploadImage } from '../../../../lib/image-upload';
import type { SnobGroup, RankingItem, RankingItemAttribute, Ranking, GroupAttribute } from '../../../../types/models';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CachedImage from '../../../../components/CachedImage';
import AttributeChips from '../../../../components/AttributeChips';
import AutocompleteInput from '../../../../components/AutocompleteInput';
import RankingList from '../../../../components/RankingList';
import RatingInput from '../../../../components/RatingInput';

export default function ItemDetailScreen() {
  const { groupId, itemId } = useLocalSearchParams<{ groupId: string; itemId: string }>();
  const authState = useAtomValue(authStateAtom);
  const router = useRouter();

  const [item, setItem] = useState<RankingItem | null>(null);
  const [group, setGroup] = useState<SnobGroup | null>(null);
  const [attributes, setAttributes] = useState<RankingItemAttribute[]>([]);
  const [rankings, setRankings] = useState<(Ranking & { memberName: string })[]>([]);
  const [userRanking, setUserRanking] = useState<Ranking | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editVisible, setEditVisible] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editAttributes, setEditAttributes] = useState<Record<string, string>>({});
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [groupAttributes, setGroupAttributes] = useState<GroupAttribute[]>([]);
  const [attrSuggestions, setAttrSuggestions] = useState<Record<string, string[]>>({});
  const [editSaving, setEditSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!itemId || !groupId || !authState.userId) return;

    // Sync latest data from server in background (silent fail if offline)
    syncGroup(groupId).catch(() => {});

    const [itemData, groupData, attrs, itemRankings, membership] = await Promise.all([
      getItem(itemId),
      getGroup(groupId),
      getItemAttributes(itemId),
      getItemRankings(itemId),
      getUserMembership(groupId, authState.userId),
    ]);

    setItem(itemData);
    setGroup(groupData);
    setAttributes(attrs);
    setRankings(itemRankings);
    setMemberId(membership?.id || null);
    setMemberRole(membership?.role || null);

    // Load current user's existing ranking
    if (membership?.id) {
      const existing = await getUserRankingForItem(itemId, membership.id);
      setUserRanking(existing);
      if (existing) {
        setRatingValue(existing.ranking);
        setNotes(existing.notes || '');
      }
    }
  }, [itemId, groupId, authState.userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSaveRanking = useCallback(async () => {
    if (ratingValue === null || !memberId || !itemId) return;

    setSaving(true);
    try {
      // Post to backend API first
      await saveRanking({
        id: userRanking?.id,
        itemId: itemId as string,
        groupMemberId: memberId,
        ranking: ratingValue,
        notes: notes.trim() || null,
      });

      // Re-sync the group from the server to pull updated rankings into local DB
      if (groupId) {
        await syncGroup(groupId as string);
      }

      await loadData();
    } catch (err) {
      console.error('Failed to save ranking:', err);
    } finally {
      setSaving(false);
    }
  }, [ratingValue, notes, memberId, itemId, userRanking, loadData]);

  const handleDeleteItem = useCallback(() => {
    if (!itemId) return;

    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item?.description}"? This will also remove all rankings for this item. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteItem(itemId as string);

              // Sync local DB to reflect deletion
              if (groupId) {
                await syncGroup(groupId as string);
              }

              // Navigate back to the group
              router.back();
            } catch (err) {
              console.error('Failed to delete item:', err);
              Alert.alert('Error', 'Failed to delete item. Only group admins can delete items.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [itemId, item?.description, groupId, router]);

  const openEditModal = useCallback(async () => {
    if (!item || !groupId) return;

    // Pre-populate edit form
    setEditDescription(item.description);
    setEditImageUri(null);

    // Load group attributes and current item attribute values
    const attrs = await getGroupAttributes(groupId);
    setGroupAttributes(attrs);

    const attrValues: Record<string, string> = {};
    for (const attr of attributes) {
      attrValues[attr.attributeId] = attr.attributeValue;
    }
    setEditAttributes(attrValues);

    // Load suggestions
    const suggestions: Record<string, string[]> = {};
    for (const attr of attrs) {
      suggestions[attr.id] = await getDistinctAttributeValues(groupId as string, attr.id);
    }
    setAttrSuggestions(suggestions);

    setEditVisible(true);
  }, [item, groupId, attributes]);

  const handleSaveEdit = useCallback(async () => {
    if (!editDescription.trim() || !itemId || !groupId) return;

    setEditSaving(true);
    try {
      // Upload new image if selected
      let imageId = item?.imageId || null;
      let imageUrl = item?.imageUrl || null;
      if (editImageUri) {
        const uploaded = await uploadImage(editImageUri);
        imageId = uploaded.publicId;
        imageUrl = uploaded.url;
      }

      // Build attribute list
      const attrList = Object.entries(editAttributes)
        .filter(([_, value]) => value.trim())
        .map(([attrId, value]) => ({ attributeId: attrId, attributeValue: value.trim() }));

      // Post to backend
      await updateItem({
        id: itemId as string,
        description: editDescription.trim(),
        imageId,
        imageUrl,
        attributes: attrList,
      });

      // Re-sync and reload
      await syncGroup(groupId as string);
      await loadData();

      setEditVisible(false);
    } catch (err) {
      console.error('Failed to update item:', err);
    } finally {
      setEditSaving(false);
    }
  }, [editDescription, editAttributes, editImageUri, itemId, groupId, item, loadData]);

  if (!item || !group) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge">Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Stack.Screen options={{ title: item.description }} />

      {/* Item Image */}
      {item.imageUrl && (
        <CachedImage
          uri={item.imageUrl}
          style={styles.image}
          contentFit="cover"
        />
      )}

      {/* Item Info */}
      <Surface style={styles.infoCard} elevation={1}>
        <Text variant="headlineSmall" style={styles.itemTitle}>
          {item.description}
        </Text>

        <View style={styles.ratingRow}>
          {item.averageRanking !== null ? (
            <>
              <View style={styles.starsRow}>
                {Array.from({ length: group.maxRanking }, (_, i) => {
                  const starVal = i + 1;
                  const isFilled = item.averageRanking! >= starVal;
                  const isHalf = !isFilled && item.averageRanking! >= starVal - 0.5;
                  return (
                    <MaterialCommunityIcons
                      key={i}
                      name={isFilled ? 'star' : isHalf ? 'star-half-full' : 'star-outline'}
                      size={22}
                      color={isFilled || isHalf ? '#FFB300' : '#bdbdbd'}
                    />
                  );
                })}
              </View>
              <Text variant="titleMedium" style={styles.averageRating}>
                ({item.averageRanking.toFixed(1)})
              </Text>
            </>
          ) : (
            <Text variant="titleMedium" style={styles.pendingRating}>
              Rank Pending
            </Text>
          )}
        </View>

        {attributes.length > 0 && (
          <View style={styles.attributesSection}>
            <AttributeChips attributes={attributes} />
          </View>
        )}

        {item.createdDate && (
          <Text variant="bodySmall" style={styles.dateAdded}>
            Added {new Date(item.createdDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        )}

        <Button
          mode="text"
          icon="pencil"
          onPress={openEditModal}
          compact
          style={styles.editButton}
        >
          Edit Item
        </Button>

        {memberRole === 'ADMIN' && (
          <Button
            mode="text"
            icon="delete"
            onPress={handleDeleteItem}
            loading={deleting}
            disabled={deleting}
            compact
            textColor="#B3261E"
            style={styles.deleteButton}
          >
            Delete Item
          </Button>
        )}
      </Surface>

      {/* User's Rating */}
      <Surface style={styles.ratingCard} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {userRanking ? 'Your Rating' : 'Rate This Item'}
        </Text>

        <RatingInput
          value={ratingValue}
          onChange={setRatingValue}
          minRanking={group.minRanking}
          maxRanking={group.maxRanking}
          increments={group.increments}
          rankIcon={group.rankIcon}
        />

        <TextInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.notesInput}
        />

        <Button
          mode="contained"
          onPress={handleSaveRanking}
          loading={saving}
          disabled={saving || ratingValue === null}
          style={styles.saveButton}
        >
          {userRanking ? 'Update Rating' : 'Submit Rating'}
        </Button>
      </Surface>

      {/* All Rankings */}
      {rankings.length > 0 && (
        <Surface style={styles.rankingsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            All Rankings ({rankings.length})
          </Text>
          <Divider style={styles.divider} />
          <RankingList rankings={rankings} maxRanking={group.maxRanking} />
        </Surface>
      )}

      {/* Edit Item Modal */}
      <Portal>
        <Modal
          visible={editVisible}
          onDismiss={() => setEditVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Edit Item
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <TextInput
              label="Description"
              value={editDescription}
              onChangeText={setEditDescription}
              mode="outlined"
              style={styles.input}
            />

            {groupAttributes.map((attr) => (
              <AutocompleteInput
                key={attr.id}
                label={attr.name}
                value={editAttributes[attr.id] || ''}
                onChangeText={(text) =>
                  setEditAttributes((prev) => ({ ...prev, [attr.id]: text }))
                }
                suggestions={attrSuggestions[attr.id] || []}
              />
            ))}

            {/* Image picker */}
            <View style={styles.imagePickerRow}>
              {editImageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: editImageUri }} style={styles.imagePreview} />
                  <IconButton
                    icon="close-circle"
                    size={20}
                    onPress={() => setEditImageUri(null)}
                    style={styles.removeImageBtn}
                    iconColor="#B3261E"
                  />
                </View>
              ) : item.imageUrl ? (
                <View style={styles.imagePreviewContainer}>
                  <CachedImage uri={item.imageUrl} style={styles.imagePreview} contentFit="cover" />
                  <Text variant="bodySmall" style={styles.currentImageLabel}>Current image</Text>
                </View>
              ) : null}
              <View style={styles.imageButtons}>
                <Button
                  mode="outlined"
                  icon="image"
                  onPress={async () => {
                    const uri = await pickImage();
                    if (uri) setEditImageUri(uri);
                  }}
                  compact
                >
                  Library
                </Button>
                <Button
                  mode="outlined"
                  icon="camera"
                  onPress={async () => {
                    const uri = await takePhoto();
                    if (uri) setEditImageUri(uri);
                  }}
                  compact
                >
                  Camera
                </Button>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setEditVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveEdit}
              loading={editSaving}
              disabled={editSaving || !editDescription.trim()}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dfeffa',
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 250,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  averageRating: {
    color: '#1976d2',
    fontWeight: '600',
  },
  pendingRating: {
    color: '#757575',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  attributesSection: {
    marginTop: 8,
  },
  dateAdded: {
    color: '#757575',
    marginTop: 12,
  },
  ratingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  notesInput: {
    marginTop: 12,
  },
  saveButton: {
    marginTop: 16,
  },
  rankingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  divider: {
    marginBottom: 12,
  },
  editButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  modal: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginVertical: 'auto',
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  modalScroll: {
    flexGrow: 1,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  imagePreviewContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    margin: 0,
    backgroundColor: '#ffffff',
  },
  currentImageLabel: {
    color: '#757575',
    marginTop: 4,
    fontSize: 10,
  },
  imageButtons: {
    flex: 1,
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
