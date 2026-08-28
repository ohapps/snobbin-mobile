import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import type { PendingInvite } from '../lib/api-client';

interface InviteCardProps {
  invite: PendingInvite;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  declining: boolean;
}

export default function InviteCard({ invite, onAccept, onDecline, accepting, declining }: InviteCardProps) {
  const disabled = accepting || declining;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.header}>
          <Text variant="labelSmall" style={styles.badge}>INVITATION</Text>
        </View>
        <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
          {invite.groupName}
        </Text>
        {invite.groupDescription ? (
          <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
            {invite.groupDescription}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={onDecline}
            loading={declining}
            disabled={disabled}
            compact
            textColor="#B3261E"
            style={styles.declineButton}
          >
            Decline
          </Button>
          <Button
            mode="contained"
            onPress={onAccept}
            loading={accepting}
            disabled={disabled}
            compact
            buttonColor="#1565c0"
            style={styles.acceptButton}
          >
            Accept
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  header: {
    marginBottom: 4,
  },
  badge: {
    color: '#1976d2',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    color: '#546e7a',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  declineButton: {
    borderColor: '#B3261E',
  },
  acceptButton: {},
});
