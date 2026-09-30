import React, { useState, useEffect } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useTheme } from '@/components/theme'
import Ladang from '@/components/Ladang'
import Tombol from '@/components/Tombol'
import { useAuth } from '@/lib/auth'
import supabase, { getAuthMethods } from '@/lib/supabase'

type Mode = 'password' | 'phone'
const redirectTo = Platform.OS === 'web' ? window.location.origin + '/nusakarya/teknisi/' : Linking.createURL('auth/callback', { scheme: 'nusakaryateknisi' })
WebBrowser.maybeCompleteAuthSession()

function normalizePhone(raw: string) {
  const clean = raw.replace(/\D/g, '')
  if (raw.trim().startsWith('+')) return `+${clean}`
  if (clean.startsWith('0')) return `+62${clean.slice(1)}`
  if (clean.startsWith('62')) return `+${clean}`
  return `+${clean}`
}

export default function LoginScreen() {
  const t = useTheme()
  const { signIn } = useAuth()
  const [methods, setMethods] = useState({ google: false, phone: false })
  useEffect(() => { getAuthMethods().then(setMethods) }, [])
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    if (!email || !password) { setError('Email dan kata sandi wajib diisi.'); return }
    setLoading(true)
    try { await signIn(email.trim(), password) }
    catch (e: any) { setError(e?.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : e?.message ?? 'Gagal masuk. Coba lagi.') }
    finally { setLoading(false) }
  }

  const google = async () => {
    if (!methods.google) return
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (error) setError(error.message)
      return
    }
    setError(''); setLoading(true)
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
      })
      if (oauthError) throw oauthError
      if (!data.url) throw new Error('URL login Google tidak tersedia.')
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success' && result.url) {
        const hash = result.url.split('#')[1] ?? ''
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const oauthError = params.get('error_description')
        if (oauthError) throw new Error(oauthError)
        if (!access_token || !refresh_token) throw new Error('Sesi Google tidak diterima. Coba lagi.')
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
        if (sessionError) throw sessionError
      }
    } catch (e: any) { setError(e?.message ?? 'Login Google gagal. Periksa konfigurasi provider.') }
    finally { setLoading(false) }
  }

  const phoneLogin = async () => {
    setError('')
    const normalized = normalizePhone(phone)
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) { setError('Masukkan nomor HP dengan kode negara.'); return }
    setLoading(true)
    try {
      if (!otpSent) {
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: false } })
        if (otpError) throw otpError
        setPhone(normalized); setOtpSent(true)
      } else {
        const { error: verifyError } = await supabase.auth.verifyOtp({ phone: normalized, token: otp.trim(), type: 'sms' })
        if (verifyError) throw verifyError
      }
    } catch (e: any) { setError(e?.message ?? 'OTP gagal. Pastikan nomor terverifikasi pada akun perusahaan.') }
    finally { setLoading(false) }
  }

  const changeMode = (next: Mode) => { setMode(next); setError(''); setOtp(''); setOtpSent(false) }

  return (
    <KeyboardAvoidingView style={[styles.wrap, { backgroundColor: t.dark }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}>
        <View style={[styles.logoBadge, { backgroundColor: t.primary }]}><Text style={styles.logoTxt}>NK</Text></View>
        <Text style={styles.brandTitle}>NUSAKARYA</Text>
        <Text style={[styles.brandSub, { color: t.aksen }]}>Teknisi & Mitra Lapangan</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.card }]}>
        <Text style={[styles.judul, { color: t.text }]}>Masuk</Text>
        <Text style={{ color: t.textMuted, marginBottom: 16, fontSize: 14 }}>Gunakan akun perusahaan yang sudah terdaftar.</Text>
        <Tombol label={methods.google ? "Lanjutkan dengan Google" : "Google · segera tersedia"} disabled={!methods.google} onPress={google} loading={loading} full />
        <View style={styles.separator}><View style={[styles.line, { backgroundColor: t.border }]} /><Text style={{ color: t.textMuted }}>atau pilih metode</Text><View style={[styles.line, { backgroundColor: t.border }]} /></View>
        <View style={styles.modes}>
          <Text onPress={() => changeMode('password')} style={[styles.mode, { color: mode === 'password' ? t.primary : t.textMuted }]}>Email & sandi</Text>
          <Text onPress={() => methods.phone && changeMode('phone')} style={[styles.mode, { color: mode === 'phone' ? t.primary : t.textMuted }]}>{methods.phone ? 'Nomor HP · OTP' : 'OTP · segera tersedia'}</Text>
        </View>
        <View style={{ gap: 14 }}>
          {mode === 'password' ? <>
            <Ladang label="Email" wajib value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="nama@perusahaan.com" />
            <Ladang label="Kata Sandi" wajib value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            {error ? <Text accessibilityRole="alert" style={{ color: t.bahaya, fontSize: 14 }}>{error}</Text> : null}
            <Tombol label="Masuk" onPress={submit} loading={loading} full />
          </> : <>
            <Ladang label="Nomor HP terverifikasi" wajib value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+62 812… atau 0812…" editable={!otpSent} />
            {otpSent && <Ladang label="Kode OTP SMS" wajib value={otp} onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="6 digit" />}
            {error ? <Text accessibilityRole="alert" style={{ color: t.bahaya, fontSize: 14 }}>{error}</Text> : null}
            <Tombol label={otpSent ? 'Verifikasi & masuk' : 'Kirim kode SMS'} onPress={phoneLogin} loading={loading} full />
            {otpSent && <Text onPress={() => { setOtpSent(false); setOtp(''); setError('') }} style={{ color: t.primary, textAlign: 'center' }}>Ganti nomor</Text>}
          </>}
        </View>
        <Text style={{ color: t.textMuted, marginTop: 14, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>Gunakan email perusahaan yang sama untuk Google. SMS hanya untuk nomor yang telah terverifikasi pada akun Anda.</Text>
      </View>
      <Text style={styles.footer}>© {new Date().getFullYear()} NUSAKARYA</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: { alignItems: 'center', marginBottom: 24 },
  logoBadge: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoTxt: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  brandTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  brandSub: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  card: { borderRadius: 16, padding: 20 },
  judul: { fontSize: 20, fontWeight: '800' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 15 },
  line: { flex: 1, height: 1 },
  modes: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 14 },
  mode: { fontSize: 13, fontWeight: '700', paddingVertical: 5 },
  footer: { color: '#9FB4B8', textAlign: 'center', marginTop: 20, fontSize: 13 },
})
