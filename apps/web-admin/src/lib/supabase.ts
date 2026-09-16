import { createClient } from '@supabase/supabase-js'

/* URL dan publishable key Supabase memang dirancang publik — keduanya ikut
   ter-bundle ke peramban dan pengamannya adalah Row Level Security, bukan
   kerahasiaan kunci. Nilai bawaan di bawah dipakai bila variabel lingkungan
   tidak tersedia saat build, supaya aplikasi tidak pernah gagal muat diam-diam. */
const FALLBACK_URL = 'https://idlhsxamdkipnmyvewbp.supabase.co'
const FALLBACK_KEY = 'sb_publishable_-9Cai7RVFQ4UmQjTgjNS8w_Q84U-vc8'

const url = (import.meta.env.VITE_SUPABASE_URL as string) || FALLBACK_URL
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || FALLBACK_KEY

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('[NUSAKARYA] Variabel lingkungan Supabase tidak ditemukan; memakai nilai bawaan.')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
export default supabase
