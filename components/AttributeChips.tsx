import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import type { RankingItemAttribute } from '../types/models';

interface AttributeChipsProps {
  attributes: RankingItemAttribute[];
  compact?: boolean;
}

/**
 * Displays item attributes as Material Design chips.
 * Shows the attribute name as a label prefix and the value as the chip text.
 */
export default function AttributeChips({ attributes, compact = false }: AttributeChipsProps) {
  if (attributes.length === 0) return null;

  // Deduplicate attributes by unique name/id and value
  const uniqueAttributes = Array.from(
    new Map(
      attributes.map((attr) => [
        `${attr.attributeName || attr.attributeId}:${attr.attributeValue}`,
        attr,
      ])
    ).values()
  );

  return (
    <View style={styles.container}>
      {uniqueAttributes.map((attr) => (
        <Chip
          key={attr.id}
          compact={compact}
          style={compact ? styles.chipCompact : styles.chip}
          textStyle={compact ? styles.chipTextCompact : styles.chipText}
          mode="outlined"
        >
          {attr.attributeName ? `${attr.attributeName}: ${attr.attributeValue}` : attr.attributeValue}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    alignSelf: 'flex-start',
  },
  chipCompact: {
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 0,
    paddingVertical: 0,
  },
  chipTextCompact: {
    fontSize: 11,
    lineHeight: 15,
    marginVertical: 0,
    paddingVertical: 0,
  },
});
