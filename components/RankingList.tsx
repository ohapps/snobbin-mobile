import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import type { Ranking } from '../types/models';

interface RankingListProps {
  rankings: (Ranking & { memberName: string })[];
  maxRanking: number;
}

/**
 * Displays all rankings for an item, showing each member's rating and optional notes.
 * Long notes are truncated with a "Show more" link.
 */
export default function RankingList({ rankings, maxRanking }: RankingListProps) {
  return (
    <View style={styles.container}>
      {rankings.map((ranking) => (
        <RankingRow key={ranking.id} ranking={ranking} maxRanking={maxRanking} />
      ))}
    </View>
  );
}

function RankingRow({ ranking, maxRanking }: { ranking: Ranking & { memberName: string }; maxRanking: number }) {
  const [expanded, setExpanded] = useState(false);

  // Approximate: if notes exceed ~80 chars, it'll likely wrap beyond 2 lines
  const needsTruncation = (ranking.notes?.length ?? 0) > 80;

  return (
    <View style={styles.row}>
      <Avatar.Text
        size={36}
        label={getInitials(ranking.memberName)}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>
            {ranking.memberName}
          </Text>
          <Text variant="titleMedium" style={styles.score}>
            {ranking.ranking} / {maxRanking}
          </Text>
        </View>
        {ranking.notes && (
          <>
            <Text
              variant="bodySmall"
              style={styles.notes}
              numberOfLines={expanded ? undefined : 2}
            >
              {ranking.notes}
            </Text>
            {needsTruncation && (
              <Pressable onPress={() => setExpanded(!expanded)}>
                <Text variant="bodySmall" style={styles.showMore}>
                  {expanded ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    backgroundColor: '#E8DEF8',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  score: {
    color: '#1976d2',
    fontWeight: '600',
  },
  notes: {
    color: '#1a1c1e',
    marginTop: 2,
  },
  showMore: {
    color: '#1976d2',
    marginTop: 4,
    fontWeight: '500',
  },
});
