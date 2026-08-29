import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { FAB, Searchbar, Menu, IconButton, Text, Portal, Modal, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAtom, useAtomValue } from 'jotai';
import { authStateAtom, itemSortAtom, ItemSortOption, syncingGroupIdsAtom } from '../../store/atoms';
import {
  getGroup,
  getGroupItems,
  getGroupItemAttributes,
  getGroupAttributes,
  getUserMembership,
  getDistinctAttributeValues,
  getAttributeSummary,  
  getSnobProfile,
  syncGroup,
} from '../../lib/db';
import type { SnobGroup, RankingItem, RankingItemAttribute, GroupAttribute } from '../../types/models';
import ItemCard from '../../components/ItemCard';
import AutocompleteInput from '../../components/AutocompleteInput';
import EmptyState from '../../components/EmptyState';
import { pickImage, takePhoto, uploadImage } from '../../lib/image-upload';
import { createItem, identifyItem } from '../../lib/api-client';

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
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [groupMenuVisible, setGroupMenuVisible] = useState(false);
  const [addItemVisible, setAddItemVisible] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemAttributes, setNewItemAttributes] = useState<Record<string, string>>({});
  const [attrSuggestions, setAttrSuggestions] = useState<Record<string, string[]>>({});
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [hasLoadedLocal, setHasLoadedLocal] = useState(false);
  const [topRankingsVisible, setTopRankingsVisible] = useState(false);
  const [attributeSummary, setAttributeSummary] = useState<{ attributeId: string; attributeName: string; attributeValue: string; count: number }[]>([]);
  const syncingGroupIds = useAtomValue(syncingGroupIdsAtom);
  const isGroupSyncing = groupId ? syncingGroupIds.includes(groupId) : false;

  // Debounce search query input to keep typing smooth with large item lists
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadLocalData = useCallback(async () => {
    if (!groupId || !authState.userId) return;

    const [groupData, groupItems, attrs, membership, attrMap, snobProfile] = await Promise.all([
      getGroup(groupId),
      getGroupItems(groupId, sortBy),
      getGroupAttributes(groupId),
      getUserMembership(groupId, authState.userId),
      getGroupItemAttributes(groupId),
      getSnobProfile(authState.userId),
    ]);

    setGroup(groupData);
    setItems(groupItems);
    setGroupAttributes(attrs);
    setMemberId(membership?.id || null);
    setMemberRole(membership?.role || null);
    setIsPremiumUser(snobProfile?.isPremium ?? false);
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

  // Show full spinner only if initial local load hasn't completed or there are 0 local items while syncing
  const showLoadingState = !hasLoadedLocal || (items.length === 0 && isGroupSyncing);

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

  const handleIdentifyWithAI = useCallback(async () => {
    if (!selectedImageUri || !group) return;

    setIsIdentifying(true);
    try {
      // Upload image first to get a URL the backend can access
      const uploaded = await uploadImage(selectedImageUri);

      const result = await identifyItem({
        imageUrl: uploaded.url,
        groupName: group.name,
        groupDescription: group.description,
        attributes: groupAttributes.map((attr) => ({
          id: attr.id,
          name: attr.name,
          existingValues: attrSuggestions[attr.id] || [],
        })),
      });

      // Auto-fill form fields from AI response
      setNewItemDescription(result.description);
      const attrMap: Record<string, string> = {};
      for (const attr of result.attributes) {
        attrMap[attr.id] = attr.value;
      }
      setNewItemAttributes(attrMap);
    } catch (err) {
      console.error('AI identification failed:', err);
    } finally {
      setIsIdentifying(false);
    }
  }, [selectedImageUri, group, groupAttributes, attrSuggestions]);

  // Filter items by debounced search query
  const filteredItems = useMemo(() => {
    const trimmed = debouncedSearchQuery.trim();
    if (!trimmed) return items;
    const query = trimmed.toLowerCase();
    return items.filter((item) => {
      if (item.description.toLowerCase().includes(query)) return true;
      const attrs = itemAttributesMap[item.id] || [];
      return attrs.some((a) => a.attributeValue.toLowerCase().includes(query));
    });
  }, [items, debouncedSearchQuery, itemAttributesMap]);

  const renderItem = useCallback(
    ({ item }: { item: RankingItem }) => (
      <ItemCard
        item={item}
        attributes={itemAttributesMap[item.id] || []}
        group={group}
        onPress={() => router.push(`/group/${groupId}/item/${item.id}`)}
      />
    ),
    [itemAttributesMap, group, groupId, router]
  );

  const keyExtractor = useCallback((item: RankingItem) => item.id, []);

  const handleOpenTopRankings = useCallback(async () => {
    if (!groupId) return;
    const summary = await getAttributeSummary(groupId);
    setAttributeSummary(summary);
    setTopRankingsVisible(true);
  }, [groupId]);

  // Group attribute summary by attribute name for display
  const groupedAttributes = attributeSummary.reduce<Record<string, { attributeValue: string; count: number }[]>>(
    (acc, item) => {
      if (!acc[item.attributeName]) acc[item.attributeName] = [];
      acc[item.attributeName].push({ attributeValue: item.attributeValue, count: item.count });
      return acc;
    },
    {}
  );

  const sortLabel: Record<ItemSortOption, string> = {
    description: 'Description',
    rating: 'Rating',
    recent: 'Recent',
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: group?.name || 'Group',
        }}
      />

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

      {/* Item count and actions row */}
      <View style={styles.countRow}>
        <Text variant="bodyMedium" style={styles.countText}>
          {searchQuery
            ? `${filteredItems.length.toLocaleString()} of ${items.length.toLocaleString()} items`
            : `${items.length.toLocaleString()} items`}
        </Text>
        <View style={styles.rightActionsRow}>
          {groupAttributes.length > 0 && (
            <Pressable onPress={handleOpenTopRankings} accessibilityRole="button" accessibilityLabel="View top rankings by attribute">
              <Text variant="bodyMedium" style={styles.topRankingsLink}>
                Top Rankings
              </Text>
            </Pressable>
          )}
          <Menu
            visible={groupMenuVisible}
            onDismiss={() => setGroupMenuVisible(false)}
            contentStyle={styles.menuContent}
            anchor={
              <Pressable
                onPress={() => setGroupMenuVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Group options"
                hitSlop={8}
                style={styles.groupMenuTrigger}
              >
                <MaterialCommunityIcons name="dots-vertical" size={20} color="#546e7a" />
              </Pressable>
            }
          >
            <Menu.Item
              title="Members"
              leadingIcon="account-group"
              onPress={() => {
                setGroupMenuVisible(false);
                router.push(`/group/${groupId}/members`);
              }}
            />
            {memberRole === 'ADMIN' && (
              <Menu.Item
                title="Edit Group"
                leadingIcon="pencil"
                onPress={() => {
                  setGroupMenuVisible(false);
                  router.push(`/group/form?groupId=${groupId}`);
                }}
              />
            )}
          </Menu>
        </View>
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
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
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
            multiline
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

          {/* AI Identification — premium only */}
          {isPremiumUser && selectedImageUri && (
            <Button
              mode="outlined"
              icon="auto-fix"
              onPress={handleIdentifyWithAI}
              loading={isIdentifying}
              disabled={isIdentifying}
              style={styles.identifyButton}
            >
              Identify with AI
            </Button>
          )}

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

      {/* Top Rankings Modal */}
      <Portal>
        <Modal
          visible={topRankingsVisible}
          onDismiss={() => setTopRankingsVisible(false)}
          contentContainerStyle={styles.topRankingsModal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Top Rankings By Attribute
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.keys(groupedAttributes).length === 0 ? (
              <Text variant="bodyMedium" style={styles.emptyAttrText}>
                No attribute data yet. Add items with attributes to see rankings here.
              </Text>
            ) : (
              Object.entries(groupedAttributes).map(([attrName, values]) => (
                <View key={attrName} style={styles.attrSection}>
                  <Text variant="titleSmall" style={styles.attrTitle}>
                    {attrName}
                  </Text>
                  {values.slice(0, 10).map((val, index) => (
                    <Text key={val.attributeValue} variant="bodyMedium" style={styles.attrValue}>
                      <Text style={styles.attrRank}>{index + 1}.</Text> {val.attributeValue} ({val.count} {val.count === 1 ? 'item' : 'items'})
                    </Text>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
          <Button mode="text" onPress={() => setTopRankingsVisible(false)} style={styles.closeButton}>
            Close
          </Button>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  countText: {
    color: '#546e7a',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupMenuTrigger: {
    justifyContent: 'center',
    alignItems: 'center',
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
  identifyButton: {
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  topRankingsLink: {
    color: '#1565c0',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  topRankingsModal: {
    backgroundColor: '#dfeffa',
    margin: 24,
    padding: 24,
    borderRadius: 16,
  },
  attrSection: {
    marginBottom: 16,
  },
  attrTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  attrValue: {
    color: '#37474f',
    paddingLeft: 8,
    paddingVertical: 2,
  },
  attrRank: {
    fontWeight: '700',
  },
  emptyAttrText: {
    color: '#546e7a',
    textAlign: 'center',
    marginTop: 16,
  },
  closeButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
});
