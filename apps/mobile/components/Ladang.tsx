import React from 'react'
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native'
import { useTheme, RADIUS } from './theme'

/** Field input berlabel — konsisten dengan pola "Field" pada panel admin. */
export default function Ladang({
  label,
  wajib,
  error,
  ...rest
}: TextInputProps & { label: string; wajib?: boolean; error?: string }) {
  const t = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: t.text }]}>
        {label}
        {wajib ? <Text style={{ color: t.bahaya }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={t.textMuted}
        style={[
          styles.input,
          { borderColor: error ? t.bahaya : t.border, color: t.text, backgroundColor: t.card },
        ]}
        {...rest}
      />
      {error ? <Text style={{ color: t.bahaya, fontSize: 13 }}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    fontSize: 16,
  },
})
