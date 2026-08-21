import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, Surface } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSetAtom } from 'jotai';
import { login } from '../lib/auth';
import { syncAllUserData } from '../lib/db';
import { authStateAtom } from '../store/atoms';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthState = useSetAtom(authStateAtom);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      const authState = await login();
      console.log('[Login] Auth0 userId (sub):', authState.userId);
      console.log('[Login] Email:', authState.email);
      setAuthState(authState);

      // Start data sync in the background after login
      if (authState.userId) {
        syncAllUserData(authState.userId).catch((err) => {
          console.warn('Data sync failed:', err);
        });
      }

      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.appIcon}
          contentFit="cover"
        />
        <Text variant="headlineMedium" style={styles.brandTitle}>
          Snobbin
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Rate and rank items with your group
        </Text>

        {error && (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        )}

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#dfeffa',
  },
  card: {
    paddingVertical: 36,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 8,
  },
  brandTitle: {
    fontWeight: '700',
    color: '#0d47a1',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 32,
    textAlign: 'center',
    color: '#546e7a',
  },
  error: {
    color: '#B3261E',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#1976d2',
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
