import { StyleSheet, View } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import type { SnobGroup } from '../types/models';
import CachedImage from './CachedImage';

interface GroupCardProps {
  group: SnobGroup;
  memberCount: number;
  itemCount: number;
  onPress: () => void;
}

export default function GroupCard({ group, memberCount, itemCount, onPress }: GroupCardProps) {
  return (
    <Card style={styles.card} onPress={onPress} mode="elevated">
      {group.pictureUrl && (
        <View style={styles.imageContainer}>
          <CachedImage uri={group.pictureUrl} style={styles.image} contentFit="cover" />
        </View>
      )}
      <Card.Content style={styles.content}>
        <Text variant="titleLarge" style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        {group.description ? (
          <Text variant="bodyMedium" style={styles.description} numberOfLines={2}>
            {group.description}
          </Text>
        ) : null}
        <View style={styles.chips}>
          <Chip icon="account-group" compact style={styles.chip} textStyle={styles.chipText}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Chip>
          <Chip icon="format-list-bulleted" compact style={styles.chip} textStyle={styles.chipText}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  name: {
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#1a1c1e',
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 0,
    paddingVertical: 0,
  },
});
