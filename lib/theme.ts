import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

/**
 * Snobbin brand colors — matching the web app:
 * - Primary: #1976d2 (MUI blue — AppBar, buttons, links)
 * - Background: #dfeffa (light blue page background)
 * - Secondary/Accent: #ff9800 (orange — secondary actions)
 */

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Primary blue (matches web AppBar and buttons)
    primary: '#1976d2',
    onPrimary: '#ffffff',
    primaryContainer: '#dfeffa',
    onPrimaryContainer: '#001d36',

    // Secondary orange (matches web secondary)
    secondary: '#ff9800',
    onSecondary: '#ffffff',
    secondaryContainer: '#fff3e0',
    onSecondaryContainer: '#2e1500',

    // Tertiary
    tertiary: '#1565c0',
    onTertiary: '#ffffff',
    tertiaryContainer: '#bbdefb',
    onTertiaryContainer: '#002171',

    // Background and surfaces
    background: '#dfeffa',
    onBackground: '#1a1c1e',
    surface: '#ffffff',
    onSurface: '#1a1c1e',
    surfaceVariant: '#e3f2fd',
    onSurfaceVariant: '#42474e',

    // Error
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#410002',

    // Outline and misc
    outline: '#72787e',
    outlineVariant: '#c2c7ce',
    inverseSurface: '#2f3033',
    inverseOnSurface: '#f0f0f4',
    inversePrimary: '#90caf9',

    // Elevation tints
    elevation: {
      level0: 'transparent',
      level1: '#f3f9fe',
      level2: '#ebf5fd',
      level3: '#e3f2fd',
      level4: '#e1f1fc',
      level5: '#dceefc',
    },

    // Surface disabled
    surfaceDisabled: 'rgba(26, 28, 30, 0.12)',
    onSurfaceDisabled: 'rgba(26, 28, 30, 0.38)',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary blue (lighter for dark mode)
    primary: '#90caf9',
    onPrimary: '#003258',
    primaryContainer: '#00497d',
    onPrimaryContainer: '#d1e4ff',

    // Secondary orange
    secondary: '#ffb74d',
    onSecondary: '#462b00',
    secondaryContainer: '#654000',
    onSecondaryContainer: '#ffddb3',

    // Tertiary
    tertiary: '#64b5f6',
    onTertiary: '#003258',
    tertiaryContainer: '#004a7a',
    onTertiaryContainer: '#d1e4ff',

    // Background and surfaces
    background: '#1a1c1e',
    onBackground: '#e2e2e6',
    surface: '#1a1c1e',
    onSurface: '#e2e2e6',
    surfaceVariant: '#42474e',
    onSurfaceVariant: '#c2c7ce',

    // Error
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',

    // Outline and misc
    outline: '#8c9198',
    outlineVariant: '#42474e',
    inverseSurface: '#e2e2e6',
    inverseOnSurface: '#2f3033',
    inversePrimary: '#1976d2',

    // Elevation tints
    elevation: {
      level0: 'transparent',
      level1: '#21252a',
      level2: '#262b31',
      level3: '#2b3038',
      level4: '#2d323a',
      level5: '#30363f',
    },

    // Surface disabled
    surfaceDisabled: 'rgba(226, 226, 230, 0.12)',
    onSurfaceDisabled: 'rgba(226, 226, 230, 0.38)',
  },
};
