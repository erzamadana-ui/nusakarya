import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme, RADIUS, TOUCH_MIN } from './theme'

type Varian = 'primer' | 'sekunder' | 'bahaya' | 'ghost'

export default function Tombol({
  label,
  onPress,
  varian = 'primer',
  loading = false,
  disabled = false,
  icon,
  full = false,
}: {
  label: string
  onPress: () => void
  varian?: Varian
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  full?: boolean
}) {
  const t = useTheme()
  const nonaktif = disabled || loading

  const bg =
    varian === 'primer' ? t.primary : varian === 'bahaya' ? t.bahaya : varian === 'sekunder' ? t.card : 'transparent'
  const border = varian === 'sekunder' || varian === 'ghost' ? t.border : bg
  const warnaTeks = varian === 'primer' || varian === 'bahaya' ? '#FFFFFF' : t.primary

  return (
    <Pressable
      onPress={onPress}
      disabled={nonaktif}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: nonaktif ? 0.55 : pressed ? 0.85 : 1,
          width: full ? '100%' : undefined,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={warnaTeks} />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, { color: warnaTeks }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
})
