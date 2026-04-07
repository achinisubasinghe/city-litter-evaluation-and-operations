/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Outdoor Daylight High-Contrast Palette
    text: '#091e13', // Deep forest obsidian for glare legibility
    background: '#f1f5f3', // Anti-glare tinted parchment background
    backgroundElement: '#ffffff', // Crisp white card surface
    backgroundSelected: '#dcfce7', // Subtle green tint for selected items
    textSecondary: '#475569', // High contrast slate secondary
    border: '#cbd5e1', // Strong 1.5px border to pop in sun
    primary: '#059669', // Ceylon Emerald Green (Primary Action)
    primaryLight: '#ecfdf5',
    primaryDark: '#064e3b',
    amber: '#d97706', // High-Vis Safety Amber
    amberLight: '#fef3c7',
    sky: '#0284c7', // Colombo Harbor Blue (Nav/Directions)
    skyLight: '#e0f2fe',
    rose: '#dc2626',
    danger: '#dc2626',
  },
  dark: {
    text: '#f8fafc',
    background: '#070f1a', // Deep night shift oceanic slate
    backgroundElement: '#0f1b2b',
    backgroundSelected: '#16273e',
    textSecondary: '#94a3b8',
    border: '#1e293b',
    primary: '#10b981',
    primaryLight: '#064e3b',
    primaryDark: '#34d399',
    amber: '#fbbf24',
    amberLight: '#451a03',
    sky: '#38bdf8',
    skyLight: '#0c4a6e',
    rose: '#f87171',
    danger: '#f87171',
  },
} as const;

export const TouchTarget = {
  min: 48,
  standard: 56, // Glove-friendly primary buttons
  large: 64, // Camera & major action buttons
} as const;

export const MunicipalPresets = [
  { id: 'cmc-04', label: 'WP DAE-4920 • CMC Unit 04 (Colombo North)' },
  { id: 'cmc-11', label: 'WP DAE-8114 • CMC Unit 11 (Cinnamon Gardens)' },
  { id: 'kmc-02', label: 'WP NB-3042 • Kaduwela MC Unit 02' },
  { id: 'dmmc-01', label: 'WP NA-7719 • Dehiwala-Mount Lavinia Unit 01' },
  { id: 'gmc-01', label: 'CP DAE-1120 • Kandy Municipal Council' },
] as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
