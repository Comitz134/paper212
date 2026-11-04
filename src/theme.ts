import { Platform } from 'react-native';

export const colors = {
  bg: '#070b12',
  panel: '#0d1420',
  panel2: '#111a29',
  panel3: '#162234',
  line: '#1d2a3d',
  line2: '#2a3b54',
  text: '#e9eff8',
  muted: '#8b9ab0',
  dim: '#5e6e84',
  green: '#00c805',
  red: '#ff4d5e',
  blue: '#5b8cff',
  gold: '#f0b90b',
  orange: '#ff9f43',
  white: '#ffffff',
};

export const fontMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const radius = {
  sm: 9,
  md: 14,
  lg: 20,
  xl: 26,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
};

export function toneColor(value: number) {
  if (value > 0.000001) return colors.green;
  if (value < -0.000001) return colors.red;
  return colors.muted;
}
