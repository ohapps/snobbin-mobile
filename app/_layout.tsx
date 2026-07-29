import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { Provider as JotaiProvider, useSetAtom } from 'jotai';
import { StatusBar } from 'expo-status-bar';
import { lightTheme, darkTheme } from '../lib/theme';
import { getStoredAuth } from '../lib/auth';
import { initDatabase, syncAllUserData } from '../lib/db';
import { authStateAtom, appReadyAtom } from '../store/atoms';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const setAuthState = useSetAtom(authStateAtom);
  const setAppReady = useSetAtom(appReadyAtom);

  useEffect(() => {
    async function initialize() {
      try {
        console.log('[AppInit] Starting initialization...');

        // Initialize the local SQLite database (creates tables)
        initDatabase();

        // Check stored auth state (from expo-sqlite metadata DB)
        const storedAuth = await getStoredAuth();
        console.log('[AppInit] Got stored auth, isLoggedIn:', storedAuth.isLoggedIn, 'userId:', storedAuth.userId);
        setAuthState(storedAuth);
        setIsReady(true);
        setAppReady(true);
        console.log('[AppInit] App marked as ready');

        // Sync data from backend in the background — non-blocking.
        // The app shows cached data immediately; sync catches up when connectivity is available.
        if (storedAuth.isLoggedIn && storedAuth.userId) {
          console.log('[AppInit] Starting data sync...');
          syncAllUserData(storedAuth.userId)
            .then(() => console.log('[AppInit] Data sync complete'))
            .catch((err) => {
              console.warn('[AppInit] Data sync failed (will retry on refresh):', err);
            });
        }
      } catch (error) {
        console.error('[AppInit] Failed to initialize app:', error);
        setIsReady(true);
        setAppReady(true);
      }
    }
    initialize();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#dfeffa' }}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <JotaiProvider>
      <PaperProvider theme={theme}>
        <AppInitializer>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#1976d2' },
              headerTintColor: '#ffffff',
              headerTitleStyle: { fontWeight: '600' },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'My Groups' }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: 'Profile' }} />
            <Stack.Screen name="group/[groupId]" options={{ title: 'Group' }} />
          </Stack>
        </AppInitializer>
      </PaperProvider>
    </JotaiProvider>
  );
}
