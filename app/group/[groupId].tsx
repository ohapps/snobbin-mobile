import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { FAB, Searchbar, Menu, IconButton, Text, Portal, Modal, TextInput, Button } from 'react-native-paper';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAtom, useAtomValue } from 'jotai';
import * as Crypto from 'expo-crypto';
import { authStateAtom, itemSortAtom, ItemSortOption, syncingGroupIdsAtom } from '../../store/atoms';
import {
  getGroup,
  getGroupItems,
  getItemAttributes,
  getGroupAttributes,
  getUserMembership,
  getDistinctAttributeValues,
  executeSQL,
  syncGroup,
} from '../../lib/db';
import type { SnobGroup, RankingItem, RankingItemAttribute, GroupAttribute } from '../../types/models';
import ItemCard from '../../components/ItemCard';
import AutocompleteInput from '../../components/AutocompleteInput';
import EmptyState from '../../components/EmptyState';
import GroupSyncBanner from '../../components/GroupSyncBanner';
import { pickImage, takePhoto, uploadImage, UploadedImage } from '../../lib/image-upload';
import { createItem } from '../../lib/api-client';

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const authState = useAtomValue(authStateAtom);
  const [sortBy, setSortBy] = useAtom(itemSortAtom);
  const router = useRouter();

  const [group, setGroup] = useState<SnobGroup | null>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [itemAttributesMap, setItemAttributesMap] = useState<Record<string, RankingItemAttribute[]>>({});
  const [groupAttributes, setGroupAttributes] = useState<GroupAttribute[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [addItemVisible, setAddItemVisible] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemAttributes, setNewItemAttributes] = useState<Record<string, string>>({});
  const [attrSuggestions, setAttrSuggestions] = useState<Record<string, string[]>>({});
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasLoadedLocal, setHasLoadedLocal] = useState(false);
  const syncingGroupIds = useAtomValue(syncingGroupIdsAtom);
  const isGroupSyncing = groupId ? syncingGroupIds.includes(groupId) : false;

  const loadLocalData = useCallback(async () => {
    if (!groupId || !authState.userId) return;

    const [groupData, groupItems, attrs, membership] = await Promise.all([
      getGroup(groupId),
      getGroupItems(groupId, sortBy),
      getGroupAttributes(groupId),
      getUserMembership(groupId, authState.userId),
    ]);

    setGroup(groupData);
    setItems(groupItems);
    setGroupAttributes(attrs);
    setMemberId(membership?.id || null);

    const attrMap: Record<string, RankingItemAttribute[]> = {};
    await Promise.all(
      groupItems.map(async (item) => {
        attrMap[item.id] = await getItemAttributes(item.id);
      })
    );
    setItemAttributesMap(attrMap);
    setHasLoadedLocal(true);
  }, [groupId, authState.userId, sortBy]);

  const loadData = useCallback(async () => {
    if (!groupId || !authState.userId) return;

    await loadLocalData();

    try {
      await syncGroup(groupId);
      await loadLocalData();
    } catch {
      // Offline or sync failed — cached data from loadLocalData remains visible
    }
  }, [groupId, authState.userId, loadLocalData]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await loadLocalData();
      if (cancelled || !groupId) return;

      syncGroup(groupId)
        .then(async () => {
          if (!cancelled) await loadLocalData();
        })
        .catch(() => {});
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [groupId, authState.userId, sortBy, loadLocalData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const showLoadingState = !hasLoadedLocal || (items.length === 0 && isGroupSyncing);
  const showSyncBanner = hasLoadedLocal && items.length > 0 && isGroupSyncing;

  const handleAddItem = useCallback(async () => {
    if (!newItemDescription.trim() || !groupId || !memberId) return;

    setSaving(true);
    try {
      // Upload image if one was selected
      let imageId: string | null = null;
      let imageUrl: string | null = null;
      if (selectedImageUri) {
        const uploaded = await uploadImage(selectedImageUri);
        imageId = uploaded.publicId;
        imageUrl = uploaded.url;
      }

      // Build attribute list
      const attributes = Object.entries(newItemAttributes)
        .filter(([_, value]) => value.trim())
        .map(([attrId, value]) => ({ attributeId: attrId, attributeValue: value.trim() }));

      // Post to backend API first
      await createItem({
        groupId: groupId as string,
        description: newItemDescription.trim(),
        imageId,
        imageUrl,
        attributes,
      });

      // Re-sync the group from the server to pull the new item into local DB
      await syncGroup(groupId as string);

      setNewItemDescription('');
      setNewItemAttributes({});
      setSelectedImageUri(null);
      setAddItemVisible(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setSaving(false);
    }
  }, [newItemDescription, newItemAttributes, selectedImageUri, groupId, memberId, loadData]);

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (item.description.toLowerCase().includes(query)) return true;
    const attrs = itemAttributesMap[item.id] || [];
    return attrs.some((a) => a.attributeValue.toLowerCase().includes(query));
  });

  const sortLabel: Record<ItemSortOption, string> = {
    description: 'Description',
    rating: 'Rating',
    recent: 'Recent',
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: group?.name || 'Group' }} />

      {/* Search and Sort Row */}
      <View style={styles.toolbar}>
        <Searchbar
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          contentStyle={styles.menuContent}
          anchor={
            <IconButton
              icon="sort"
              onPress={() => setSortMenuVisible(true)}
              accessibilityLabel={`Sort by ${sortLabel[sortBy]}`}
            />
          }
        >
          <Menu.Item
            title="Description"
            leadingIcon={sortBy === 'description' ? 'check' : undefined}
            onPress={() => { setSortBy('description'); setSortMenuVisible(false); }}
          />
          <Menu.Item
            title="Rating"
            leadingIcon={sortBy === 'rating' ? 'check' : undefined}
            onPress={() => { setSortBy('rating'); setSortMenuVisible(false); }}
          />
          <Menu.Item
            title="Most Recent"
            leadingIcon={sortBy === 'recent' ? 'check' : undefined}
            onPress={() => { setSortBy('recent'); setSortMenuVisible(false); }}
          />
        </Menu>
      </View>

      {/* Item count */}
      {showSyncBanner && <GroupSyncBanner message="Updating items..." />}

      <View style={styles.countRow}>
        <Text variant="bodySmall" style={styles.countText}>
          {searchQuery
            ? `${filteredItems.length} of ${items.length} items`
            : `${items.length} items`}
        </Text>
      </View>

      {showLoadingState ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading items...
          </Text>
        </View>
      ) : filteredItems.length === 0 && !searchQuery ? (
        <EmptyState
          icon="format-list-bulleted"
          title="No Items Yet"
          message="Tap the + button to add the first item to rank."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="magnify"
          title="No Results"
          message={`No items match "${searchQuery}"`}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              attributes={itemAttributesMap[item.id] || []}
              group={group}
              onPress={() => router.push(`/group/${groupId}/item/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Add Item FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        color="#ffffff"
        onPress={async () => {
          // Load autocomplete suggestions for each attribute
          const suggestions: Record<string, string[]> = {};
          for (const attr of groupAttributes) {
            suggestions[attr.id] = await getDistinctAttributeValues(groupId as string, attr.id);
          }
          setAttrSuggestions(suggestions);
          setAddItemVisible(true);
        }}
        accessibilityLabel="Add new item"
      />

      {/* Add Item Modal */}
      <Portal>
        <Modal
          visible={addItemVisible}
          onDismiss={() => setAddItemVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Add Item
          </Text>

          <TextInput
            label="Description"
            value={newItemDescription}
            onChangeText={setNewItemDescription}
            mode="outlined"
            style={styles.input}
          />

          {groupAttributes.map((attr) => (
            <AutocompleteInput
              key={attr.id}
              label={attr.name}
              value={newItemAttributes[attr.id] || ''}
              onChangeText={(text) =>
                setNewItemAttributes((prev) => ({ ...prev, [attr.id]: text }))
              }
              suggestions={attrSuggestions[attr.id] || []}
            />
          ))}

          {/* Image picker */}
          <View style={styles.imagePickerRow}>
            {selectedImageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImageUri }} style={styles.imagePreview} />
                <IconButton
                  icon="close-circle"
                  size={20}
                  onPress={() => setSelectedImageUri(null)}
                  style={styles.removeImageButton}
                  iconColor="#B3261E"
                />
              </View>
            ) : (
              <>
                <Button
                  mode="outlined"
                  icon="image"
                  onPress={async () => {
                    const uri = await pickImage();
                    if (uri) setSelectedImageUri(uri);
                  }}
                  compact
                  style={styles.imageButton}
                >
                  Photo Library
                </Button>
                <Button
                  mode="outlined"
                  icon="camera"
                  onPress={async () => {
                    const uri = await takePhoto();
                    if (uri) setSelectedImageUri(uri);
                  }}
                  compact
                  style={styles.imageButton}
                >
                  Camera
                </Button>
              </>
            )}
          </View>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setAddItemVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddItem}
              loading={saving}
              disabled={saving || !newItemDescription.trim()}
            >
              Add
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dfeffa',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  searchbar: {
    flex: 1,
    height: 44,
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  searchInput: {
    minHeight: 0,
  },
  countRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  countText: {
    color: '#546e7a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#546e7a',
  },
  menuContent: {
    backgroundColor: '#ffffff',
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1565c0',
    borderRadius: 28,
  },
  modal: {
    backgroundColor: '#dfeffa',
    margin: 24,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    margin: 0,
    backgroundColor: '#ffffff',
  },
  imageButton: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
