import React, { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/components/theme'
import Ladang from '@/components/Ladang'
import Tombol from '@/components/Tombol'
import { useAuth } from '@/lib/auth'

export default function LoginScreen() {
  const t = useTheme()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi.')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (e: any) {
      setError(e?.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : e?.message ?? 'Gagal masuk. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.wrap, { backgroundColor: t.dark }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brand}>
        <View style={[styles.logoBadge, { backgroundColor: t.primary }]}>
          <Text style={styles.logoTxt}>NK</Text>
        </View>
        <Text style={styles.brandTitle}>NUSAKARYA</Text>
        <Text style={[styles.brandSub, { color: t.aksen }]}>Teknisi & Mitra Lapangan</Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.card }]}>
        <Text style={[styles.judul, { color: t.text }]}>Masuk</Text>
        <Text style={{ color: t.textMuted, marginBottom: 18, fontSize: 15 }}>
          Gunakan akun yang terdaftar oleh admin perusahaan Anda.
        </Text>

        <View style={{ gap: 14 }}>
          <Ladang
            label="Email"
            wajib
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="nama@perusahaan.com"
          />
          <Ladang
            label="Kata Sandi"
            wajib
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          {error ? <Text style={{ color: t.bahaya, fontSize: 14 }}>{error}</Text> : null}
          <Tombol label="Masuk" onPress={submit} loading={loading} full />
        </View>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} NUSAKARYA</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoBadge: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoTxt: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  brandTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  brandSub: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  card: { borderRadius: 16, padding: 20 },
  judul: { fontSize: 20, fontWeight: '800' },
  footer: { color: '#9FB4B8', textAlign: 'center', marginTop: 24, fontSize: 13 },
})
