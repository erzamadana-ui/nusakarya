import React, { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import KesalahanState from '@/components/KesalahanState'
import { getOne } from '@/lib/db'
import { tglJam } from '@/lib/format'
import { ambilArtikelCache, simpanArtikelCache } from '@/lib/kbCache'
import type { KnowledgeArticle } from '@/types/db'

export default function DetailArtikel() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const [artikel, setArtikel] = useState<KnowledgeArticle | null>(null)
  const [dariCache, setDariCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const row = await getOne<KnowledgeArticle>('knowledge_articles', id)
      if (!row) throw new Error('Artikel tidak ditemukan.')
      setArtikel(row)
      setDariCache(false)
      simpanArtikelCache(row)
    } catch (e: any) {
      const cache = await ambilArtikelCache(id)
      if (cache) {
        setArtikel(cache)
        setDariCache(true)
        setCachedAt((cache as any).cachedAt ?? null)
      } else {
        setError(e?.message ?? 'Gagal memuat artikel dan tidak ada versi tersimpan.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (error || !artikel) {
    return <KesalahanState pesan={error || 'Artikel tidak ditemukan.'} onCoba={muat} />
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {dariCache ? (
        <Kartu style={{ borderColor: t.peringatan, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="cloud-offline-outline" size={20} color={t.peringatan} />
          <Text style={{ color: t.peringatan, fontSize: 13, flex: 1 }}>
            Versi tersimpan (offline){cachedAt ? ` — disimpan ${tglJam(cachedAt)}` : ''}. Sambungkan internet untuk data terbaru.
          </Text>
        </Kartu>
      ) : null}

      <Kartu style={{ gap: 8 }}>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>{artikel.article_no}</Text>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 19 }}>{artikel.title}</Text>
        {artikel.category ? (
          <View style={[styles.tag, { backgroundColor: t.bg, borderColor: t.border }]}>
            <Text style={{ color: t.primary, fontSize: 12, fontWeight: '700' }}>{artikel.category}</Text>
          </View>
        ) : null}
      </Kartu>

      {artikel.symptom ? (
        <Kartu>
          <Text style={[styles.judulSeksi, { color: t.text }]}>Gejala</Text>
          <Text style={{ color: t.textMuted, fontSize: 15, marginTop: 6, lineHeight: 22 }}>{artikel.symptom}</Text>
        </Kartu>
      ) : null}

      {artikel.root_cause ? (
        <Kartu>
          <Text style={[styles.judulSeksi, { color: t.text }]}>Akar Masalah</Text>
          <Text style={{ color: t.textMuted, fontSize: 15, marginTop: 6, lineHeight: 22 }}>{artikel.root_cause}</Text>
        </Kartu>
      ) : null}

      {artikel.resolution_steps ? (
        <Kartu>
          <Text style={[styles.judulSeksi, { color: t.text }]}>Langkah Penyelesaian</Text>
          <Text style={{ color: t.text, fontSize: 15, marginTop: 6, lineHeight: 22 }}>{artikel.resolution_steps}</Text>
        </Kartu>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  judulSeksi: { fontSize: 15, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
})
