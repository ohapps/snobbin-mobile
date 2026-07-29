import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  message: string;
}

/**
 * Reusable empty state component for screens with no data.
 * Shows an icon, title, and descriptive message centered on screen.
 */
export default function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <MaterialCommunityIcons name={icon} size={64} color="#90caf9" />
      <Text variant="titleLarge" style={styles.title}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    marginTop: 16,
    fontWeight: '600',
    color: '#1a1c1e',
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
    color: '#546e7a',
    lineHeight: 22,
  },
});
