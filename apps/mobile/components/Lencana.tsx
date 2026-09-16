import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from './theme'

const PETA_WARNA: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#EEF1F4', fg: '#5B6472' },
  ditugaskan: { bg: '#E6F4F5', fg: '#1B8A92' },
  diterima: { bg: '#E6F4F5', fg: '#1B8A92' },
  berjalan: { bg: '#FEF3E2', fg: '#B26A00' },
  dikerjakan: { bg: '#FEF3E2', fg: '#B26A00' },
  proses: { bg: '#FEF3E2', fg: '#B26A00' },
  open: { bg: '#FEF3E2', fg: '#B26A00' },
  selesai: { bg: '#E7F7EC', fg: '#16A34A' },
  closed: { bg: '#E7F7EC', fg: '#16A34A' },
  disetujui: { bg: '#E7F7EC', fg: '#16A34A' },
  lunas: { bg: '#E7F7EC', fg: '#16A34A' },
  gagal: { bg: '#FDE8EC', fg: '#E11D48' },
  ditolak: { bg: '#FDE8EC', fg: '#E11D48' },
  breach: { bg: '#FDE8EC', fg: '#E11D48' },
  overdue: { bg: '#FDE8EC', fg: '#E11D48' },
  diajukan: { bg: '#EAF0FF', fg: '#3550C7' },
}

function warnaUntuk(teks: string) {
  const k = (teks || '').toLowerCase().trim()
  return PETA_WARNA[k] ?? { bg: '#EEF1F4', fg: '#5B6472' }
}

export default function Lencana({ children }: { children: string }) {
  const _t = useTheme()
  const w = warnaUntuk(children)
  return (
    <View style={[styles.base, { backgroundColor: w.bg }]}>
      <Text style={[styles.teks, { color: w.fg }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  teks: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
})
