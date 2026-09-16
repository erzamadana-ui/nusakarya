import { useColorScheme } from 'react-native'

export const LIGHT = {
  primary: '#1B8A92',
  dark: '#073A42',
  aksen: '#F5A524',
  bg: '#F7F8FA',
  card: '#FFFFFF',
  text: '#131B2C',
  textMuted: '#5B6472',
  border: '#E2E6EB',
  sukses: '#16A34A',
  bahaya: '#E11D48',
  peringatan: '#F59E0B',
  info: '#3AA3AA',
}

export const DARK = {
  primary: '#2FAAB2',
  dark: '#051F24',
  aksen: '#F5A524',
  bg: '#0B1418',
  card: '#10232A',
  text: '#EAF2F2',
  textMuted: '#9FB4B8',
  border: '#1E3A40',
  sukses: '#22C55E',
  bahaya: '#F43F5E',
  peringatan: '#FBBF24',
  info: '#3AA3AA',
}

export type Palette = typeof LIGHT

export function useTheme(): Palette {
  const scheme = useColorScheme()
  return scheme === 'dark' ? DARK : LIGHT
}

export const RADIUS = 10
export const TOUCH_MIN = 44
