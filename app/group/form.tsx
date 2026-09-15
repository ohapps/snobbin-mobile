import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAtomValue } from 'jotai';
import { authStateAtom } from '../../store/atoms';
import { getGroup, getGroupAttributes, syncAllUserData, syncGroup } from '../../lib/db';
import { createGroup, updateGroup, deleteGroup, SaveGroupPayload } from '../../lib/api-client';
import { pickImage, uploadImage } from '../../lib/image-upload';
import type { GroupAttribute } from '../../types/models';

interface AttributeField {
  id?: string;
  name: string;
}

export default function GroupFormScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const authState = useAtomValue(authStateAtom);
  const router = useRouter();
  const isEdit = Boolean(groupId);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minRanking, setMinRanking] = useState('1');
  const [maxRanking, setMaxRanking] = useState('5');
  const [increments, setIncrements] = useState(0.5);
  const [rankIcon, setRankIcon] = useState('star');
  const [rankingsRequired, setRankingsRequired] = useState('1');
  const [attributes, setAttributes] = useState<AttributeField[]>([]);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [incrementsMenuVisible, setIncrementsMenuVisible] = useState(false);
  const [iconMenuVisible, setIconMenuVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing group data in edit mode
  useEffect(() => {
    if (!groupId) return;

    async function loadGroupData() {
      try {
        const [group, groupAttrs] = await Promise.all([
          getGroup(groupId as string),
          getGroupAttributes(groupId as string),
        ]);

        if (group) {
          setName(group.name);
          setDescription(group.description || '');
          setMinRanking(String(group.minRanking));
          setMaxRanking(String(group.maxRanking));
          setIncrements(group.increments);
          setRankIcon(group.rankIcon || 'star');
          setRankingsRequired(String(group.rankingsRequired));
          setPictureUrl(group.pictureUrl);
        }

        if (groupAttrs.length > 0) {
          setAttributes(groupAttrs.map((a) => ({ id: a.id, name: a.name })));
        }
      } catch (err) {
        console.error('[GroupForm] Failed to load group data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

  const handlePickImage = useCallback(async () => {
    const uri = await pickImage();
    if (uri) {
      setSelectedImageUri(uri);
    }
  }, []);

  const handleAddAttribute = useCallback(() => {
    setAttributes((prev) => [...prev, { name: '' }]);
  }, []);

  const handleRemoveAttribute = useCallback((index: number) => {
    const attr = attributes[index];
    if (attr.id) {
      // Existing attribute — warn about data loss
      Alert.alert(
        'Delete Attribute',
        `Delete "${attr.name}"? Any item data for this attribute will be permanently removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => setAttributes((prev) => prev.filter((_, i) => i !== index)),
          },
        ]
      );
    } else {
      // New attribute (not yet saved) — remove without warning
      setAttributes((prev) => prev.filter((_, i) => i !== index));
    }
  }, [attributes]);

  const handleAttributeChange = useCallback((index: number, value: string) => {
    setAttributes((prev) =>
      prev.map((attr, i) => (i === index ? { ...attr, name: value } : attr))
    );
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    const minVal = parseFloat(minRanking);
    if (isNaN(minVal)) {
      newErrors.minRanking = 'Must be a number';
    } else if (minVal < 0) {
      newErrors.minRanking = 'Must be 0 or greater';
    }

    const maxVal = parseFloat(maxRanking);
    if (isNaN(maxVal)) {
      newErrors.maxRanking = 'Must be a number';
    } else if (maxVal < 0) {
      newErrors.maxRanking = 'Must be 0 or greater';
    }

    if (!isNaN(minVal) && !isNaN(maxVal) && minVal >= maxVal) {
      newErrors.maxRanking = 'Must be greater than min ranking';
    }

    const reqVal = parseInt(rankingsRequired, 10);
    if (isNaN(reqVal)) {
      newErrors.rankingsRequired = 'Must be a number';
    } else if (reqVal < 1) {
      newErrors.rankingsRequired = 'Must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, description, minRanking, maxRanking, rankingsRequired]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      // Upload image if a new one was selected
      let finalPictureUrl = pictureUrl;
      if (selectedImageUri) {
        const uploaded = await uploadImage(selectedImageUri);
        finalPictureUrl = uploaded.url;
      }

      const payload: SaveGroupPayload = {
        name: name.trim(),
        description: description.trim(),
        minRanking: parseFloat(minRanking),
        maxRanking: parseFloat(maxRanking),
        increments,
        rankIcon,
        rankingsRequired: parseInt(rankingsRequired, 10),
        pictureUrl: finalPictureUrl,
        attributes: attributes.filter((a) => a.name.trim()).map((a) => ({
          ...(a.id ? { id: a.id } : {}),
          name: a.name.trim(),
        })),
      };

      if (isEdit && groupId) {
        await updateGroup(groupId, payload);
        await syncGroup(groupId);
        router.back();
      } else {
        const result = await createGroup(payload);
        if (authState.userId) {
          await syncAllUserData(authState.userId);
        }
        router.replace(`/group/${result.id}`);
      }
    } catch (err) {
      console.error('[GroupForm] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [
    validate, name, description, minRanking, maxRanking, increments, rankIcon,
    rankingsRequired, attributes, pictureUrl, selectedImageUri,
    isEdit, groupId, authState.userId, router,
  ]);

  const handleDelete = useCallback(() => {
    if (!groupId) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGroup(groupId);
              if (authState.userId) {
                await syncAllUserData(authState.userId);
              }
              router.replace('/');
            } catch (err) {
              console.error('[GroupForm] Delete failed:', err);
              Alert.alert('Error', 'Failed to delete the group. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [groupId, name, authState.userId, router]);

  const imagePreviewUri = selectedImageUri || pictureUrl;

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: isEdit ? 'Edit Group' : 'Create Group' }} />
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: isEdit ? 'Edit Group' : 'Create Group' }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {/* Image */}
        <View style={styles.imageSection}>
          {imagePreviewUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imagePreviewUri }} style={styles.imagePreview} />
              <IconButton
                icon="close-circle"
                size={20}
                onPress={() => {
                  setSelectedImageUri(null);
                  setPictureUrl(null);
                }}
                style={styles.removeImageButton}
                iconColor="#B3261E"
              />
            </View>
          ) : (
            <Button mode="outlined" icon="image" onPress={handlePickImage}>
              Add Group Photo
            </Button>
          )}
          {imagePreviewUri && (
            <Button mode="text" icon="image" onPress={handlePickImage} compact>
              Change Photo
            </Button>
          )}
        </View>

        {/* Name */}
        <TextInput
          label="Name *"
          value={name}
          onChangeText={(text) => { setName(text); setErrors((e) => ({ ...e, name: '' })); }}
          mode="outlined"
          style={styles.input}
          error={!!errors.name}
        />
        {errors.name ? <HelperText type="error" style={styles.errorText}>{errors.name}</HelperText> : null}

        {/* Description */}
        <TextInput
          label="Description *"
          value={description}
          onChangeText={(text) => { setDescription(text); setErrors((e) => ({ ...e, description: '' })); }}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.input}
          error={!!errors.description}
        />
        {errors.description ? <HelperText type="error" style={styles.errorText}>{errors.description}</HelperText> : null}

        {/* Ranking settings row */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <TextInput
              label="Min Ranking"
              value={minRanking}
              onChangeText={(text) => { setMinRanking(text); setErrors((e) => ({ ...e, minRanking: '' })); }}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              error={!!errors.minRanking}
            />
            {errors.minRanking ? <HelperText type="error" style={styles.errorText}>{errors.minRanking}</HelperText> : null}
          </View>
          <View style={styles.halfInput}>
            <TextInput
              label="Max Ranking"
              value={maxRanking}
              onChangeText={(text) => { setMaxRanking(text); setErrors((e) => ({ ...e, maxRanking: '' })); }}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              error={!!errors.maxRanking}
            />
            {errors.maxRanking ? <HelperText type="error" style={styles.errorText}>{errors.maxRanking}</HelperText> : null}
          </View>
        </View>

        {/* Increments picker */}
        <Menu
          visible={incrementsMenuVisible}
          onDismiss={() => setIncrementsMenuVisible(false)}
          contentStyle={styles.menuContent}
          anchor={
            <TextInput
              label="Increments"
              value={String(increments)}
              mode="outlined"
              style={styles.input}
              editable={false}
              right={<TextInput.Icon icon="menu-down" onPress={() => setIncrementsMenuVisible(true)} />}
              onPressIn={() => setIncrementsMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            title="0.5"
            onPress={() => { setIncrements(0.5); setIncrementsMenuVisible(false); }}
          />
          <Menu.Item
            title="1"
            onPress={() => { setIncrements(1); setIncrementsMenuVisible(false); }}
          />
        </Menu>

        {/* Rank Icon picker */}
        <Menu
          visible={iconMenuVisible}
          onDismiss={() => setIconMenuVisible(false)}
          contentStyle={styles.menuContent}
          anchor={
            <TextInput
              label="Rank Icon"
              value={rankIcon}
              mode="outlined"
              style={styles.input}
              editable={false}
              right={<TextInput.Icon icon="menu-down" onPress={() => setIconMenuVisible(true)} />}
              onPressIn={() => setIconMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            title="star"
            leadingIcon="star"
            onPress={() => { setRankIcon('star'); setIconMenuVisible(false); }}
          />
          <Menu.Item
            title="favorite"
            leadingIcon="heart"
            onPress={() => { setRankIcon('favorite'); setIconMenuVisible(false); }}
          />
        </Menu>

        {/* Rankings Required */}
        <TextInput
          label="Rankings Required"
          value={rankingsRequired}
          onChangeText={(text) => { setRankingsRequired(text); setErrors((e) => ({ ...e, rankingsRequired: '' })); }}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          error={!!errors.rankingsRequired}
        />
        {errors.rankingsRequired ? <HelperText type="error" style={styles.errorText}>{errors.rankingsRequired}</HelperText> : null}

        {/* Attributes */}
        <View style={styles.attributesSection}>
          <View style={styles.attributesHeader}>
            <Text variant="titleMedium">Attributes</Text>
            <IconButton icon="plus" onPress={handleAddAttribute} />
          </View>
          {attributes.map((attr, index) => (
            <View key={index} style={styles.attributeRow}>
              <TextInput
                label={`Attribute ${index + 1}`}
                value={attr.name}
                onChangeText={(text) => handleAttributeChange(index, text)}
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
              />
              <IconButton
                icon="close"
                size={20}
                onPress={() => handleRemoveAttribute(index)}
                iconColor="#B3261E"
              />
            </View>
          ))}
          {attributes.length === 0 && (
            <Text variant="bodySmall" style={styles.hintText}>
              Attributes let members categorize items (e.g., &quot;Brand&quot;, &quot;Style&quot;).
            </Text>
          )}
        </View>

        {/* Save button */}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || deleting || !name.trim() || !description.trim()}
          style={styles.saveButton}
          buttonColor="#1565c0"
        >
          {isEdit ? 'Save Changes' : 'Create Group'}
        </Button>

        {/* Delete button (edit mode only) */}
        {isEdit && (
          <Button
            mode="outlined"
            onPress={handleDelete}
            loading={deleting}
            disabled={saving || deleting}
            style={styles.deleteButton}
            textColor="#B3261E"
            icon="delete"
          >
            Delete Group
          </Button>
        )}
      </ScrollView>
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
  },
  loadingText: {
    color: '#546e7a',
  },
  form: {
    padding: 16,
    paddingBottom: 40,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  menuContent: {
    backgroundColor: '#ffffff',
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    margin: 0,
    backgroundColor: '#ffffff',
  },
  attributesSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  attributesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hintText: {
    color: '#546e7a',
    marginTop: 4,
  },
  errorText: {
    marginTop: -8,
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 16,
    borderColor: '#B3261E',
  },
});
