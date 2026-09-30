import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import supabase from '@/lib/supabase'

export default function AuthCallback() {
 const url = Linking.useURL()
 const router = useRouter()
 const [error, setError] = useState('')
 useEffect(() => {
  if (!url) return
  let cancelled = false
  const finish = async () => {
   try {
    const params = new URLSearchParams(url.split('#')[1] ?? '')
    if (params.get('error_description')) throw new Error('Autentikasi dibatalkan atau gagal. Silakan masuk kembali.')
    const access_token = params.get('access_token'), refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sessionError) throw sessionError
    }
    const { data } = await supabase.auth.getSession()
    if (!cancelled) router.replace(data.session ? '/' : '/login')
   } catch { if (!cancelled) setError('Sesi belum dapat diterima. Kembali ke halaman masuk dan coba lagi.') }
  }
  finish()
  return () => { cancelled = true }
 }, [url, router])
 return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text>{error || 'Menyelesaikan proses masuk…'}</Text>{error && <Text onPress={() => router.replace('/login')} style={{ marginTop: 20, color: '#4F46E5' }}>Kembali ke halaman masuk</Text>}</View>
}
