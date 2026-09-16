import React from 'react'
import { View, ViewProps, StyleSheet } from 'react-native'
import { useTheme, RADIUS } from './theme'

export default function Kartu({ style, children, ...rest }: ViewProps) {
  const t = useTheme()
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: t.card, borderColor: t.border },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 14,
  },
})
