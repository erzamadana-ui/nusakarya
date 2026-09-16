import React, { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import type { KnowledgeArticle } from '@/types/db'

export default function BasisPengetahuan() {
  const t = useTheme()
  const router = useRouter()
  const { profile } = useAuth()
  const [q, setQ] = useState('')
  const [data, setData] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [sudahCari, setSudahCari] = useState(false)
  const [error, setError] = useState('')

  const cari = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    setSudahCari(true)
    try {
      let query = supabase.from('knowledge_articles').select('*').eq('company_id', profile.company_id).eq('is_published', true)
      const key = q.trim()
      if (key) {
        query = query.or(`title.ilike.%${key}%,symptom.ilike.%${key}%`)
      }
      const { data: rows, error: err } = await query.order('view_count', { ascending: false }).limit(50)
      if (err) throw err
      setData((rows ?? []) as KnowledgeArticle[])
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mencari artikel. Periksa koneksi internet Anda.')
    } finally {
      setLoading(false)
    }
  }, [profile, q])

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ color: t.textMuted, fontSize: 14 }}>
          Cari solusi berdasarkan judul atau gejala masalah. Artikel yang pernah dibuka tetap dapat diakses saat sinyal buruk.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={cari}
            returnKeyType="search"
            placeholder="Cari judul atau gejala masalah..."
            placeholderTextColor={t.textMuted}
            style={[styles.cari, { borderColor: t.border, color: t.text, backgroundColor: t.card }]}
          />
          <Pressable onPress={cari} style={[styles.tombolCari, { backgroundColor: t.primary }]}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={t.primary} size="large" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12, flexGrow: 1 }}
          data={data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !sudahCari ? (
              <KosongState judul="Cari solusi masalah" pesan="Ketik kata kunci lalu tekan cari." ikon="search-outline" />
            ) : error ? (
              <KesalahanState pesan={error} onCoba={cari} />
            ) : (
              <KosongState judul="Tidak ditemukan" pesan="Coba kata kunci lain." ikon="document-text-outline" />
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/artikel/${item.id}`)}>
              <Kartu style={{ gap: 6 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
                {item.symptom ? (
                  <Text style={{ color: t.textMuted, fontSize: 14 }} numberOfLines={2}>
                    {item.symptom}
                  </Text>
                ) : null}
                {item.category ? (
                  <View style={[styles.tagKategori, { backgroundColor: t.bg, borderColor: t.border }]}>
                    <Text style={{ color: t.primary, fontSize: 12, fontWeight: '700' }}>{item.category}</Text>
                  </View>
                ) : null}
              </Kartu>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cari: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 12, fontSize: 16 },
  tombolCari: { width: 44, height: 44, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' },
  tagKategori: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
})
