import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RankingItem, RankingItemAttribute, SnobGroup } from '../types/models';
import CachedImage from './CachedImage';
import AttributeChips from './AttributeChips';

interface ItemCardProps {
  item: RankingItem;
  attributes: RankingItemAttribute[];
  group: SnobGroup | null;
  onPress: () => void;
}

export default function ItemCard({ item, attributes, group, onPress }: ItemCardProps) {
  const maxRanking = group?.maxRanking ?? 5;

  return (
    <Card style={styles.card} onPress={onPress} mode="elevated">
      <View style={styles.row}>
        {item.imageUrl && (
          <CachedImage uri={item.imageUrl} style={styles.thumbnail} contentFit="cover" />
        )}
        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.ratingRow}>
            {item.averageRanking !== null ? (
              <>
                <View style={styles.starsRow}>
                  {Array.from({ length: maxRanking }, (_, i) => {
                    const starVal = i + 1;
                    const isFilled = item.averageRanking! >= starVal;
                    const isHalf = !isFilled && item.averageRanking! >= starVal - 0.5;
                    return (
                      <MaterialCommunityIcons
                        key={i}
                        name={isFilled ? 'star' : isHalf ? 'star-half-full' : 'star-outline'}
                        size={16}
                        color={isFilled || isHalf ? '#FFB300' : '#bdbdbd'}
                      />
                    );
                  })}
                </View>
                <Text variant="bodyMedium" style={styles.ratingText}>
                  ({item.averageRanking.toFixed(1)})
                </Text>
              </>
            ) : (
              <Text variant="bodyMedium" style={styles.pendingRating}>
                Rank Pending
              </Text>
            )}
          </View>

          {attributes.length > 0 && (
            <View style={styles.attributes}>
              <AttributeChips attributes={attributes} compact />
            </View>
          )}

          {item.createdDate && (
            <Text variant="bodySmall" style={styles.dateText}>
              Added {formatDate(item.createdDate)}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginLeft: 12,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  description: {
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: {
    color: '#1976d2',
    fontWeight: '600',
    fontSize: 13,
  },
  pendingRating: {
    color: '#757575',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  attributes: {
    marginTop: 4,
  },
  dateText: {
    color: '#757575',
    marginTop: 4,
  },
});
