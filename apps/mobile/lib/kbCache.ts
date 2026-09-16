import AsyncStorage from '@react-native-async-storage/async-storage'
import type { KnowledgeArticle } from '@/types/db'

const KEY = 'kb_cache_v1'
const MAKS_ARTIKEL = 20

type ArtikelTersimpan = KnowledgeArticle & { cachedAt: string }

async function bacaSemua(): Promise<ArtikelTersimpan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Ambil artikel dari cache lokal (dipakai saat gagal memuat dari server). */
export async function ambilArtikelCache(id: string): Promise<ArtikelTersimpan | null> {
  const semua = await bacaSemua()
  return semua.find((a) => a.id === id) ?? null
}

/** Simpan/perbarui artikel ke cache 20 terakhir yang dibuka. */
export async function simpanArtikelCache(artikel: KnowledgeArticle): Promise<void> {
  try {
    const semua = await bacaSemua()
    const tanpaIni = semua.filter((a) => a.id !== artikel.id)
    const baru: ArtikelTersimpan[] = [{ ...artikel, cachedAt: new Date().toISOString() }, ...tanpaIni].slice(0, MAKS_ARTIKEL)
    await AsyncStorage.setItem(KEY, JSON.stringify(baru))
  } catch {
    // Simpan cache bersifat best-effort — abaikan bila gagal (mis. penyimpanan penuh)
  }
}
