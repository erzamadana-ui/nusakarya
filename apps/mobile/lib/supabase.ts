import { Platform } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

/* URL dan publishable key Supabase memang dirancang publik — keduanya ikut
   ter-bundle ke aplikasi dan pengamannya adalah Row Level Security, bukan
   kerahasiaan kunci. Nilai bawaan dipakai bila variabel lingkungan tidak
   tersedia saat build (mis. .env tidak ikut ter-commit), supaya aplikasi
   tidak pernah gagal muat diam-diam. */
const FALLBACK_URL = 'https://idlhsxamdkipnmyvewbp.supabase.co'
const FALLBACK_KEY = 'sb_publishable_-9Cai7RVFQ4UmQjTgjNS8w_Q84U-vc8'

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL as string) || FALLBACK_URL
const key = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) || FALLBACK_KEY

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[NUSAKARYA] Variabel lingkungan Supabase tidak ditemukan; memakai nilai bawaan.')
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
})

export default supabase

export async function getAuthMethods(): Promise<{ google: boolean; phone: boolean }> {
 try {
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
  if (!response.ok) return { google: false, phone: false }
  const data = await response.json()
  return { google: data.external?.google === true, phone: data.external?.phone === true }
 } catch { return { google: false, phone: false } }
}
