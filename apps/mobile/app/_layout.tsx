import React, { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/lib/auth'
import { useTheme } from '@/components/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

function Gerbang() {
  const { loading, session } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const t = useTheme()

  useEffect(() => {
    if (loading) return
    SplashScreen.hideAsync().catch(() => {})
    const diLogin = segments[0] === 'login'
    if (!session && !diLogin) router.replace('/login')
    else if (session && diLogin) router.replace('/')
  }, [loading, session, segments, router])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.dark },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="absensi" options={{ title: 'Absensi' }} />
      <Stack.Screen name="wo/[id]" options={{ title: 'Detail Work Order' }} />
      <Stack.Screen name="tiket/[id]" options={{ title: 'Detail Tiket' }} />
      <Stack.Screen name="material/baru" options={{ title: 'Permintaan Material' }} />
      <Stack.Screen name="material/[id]" options={{ title: 'Detail Permintaan' }} />
      <Stack.Screen name="k3/lapor-insiden" options={{ title: 'Lapor Insiden' }} />
      <Stack.Screen name="k3/izin-kerja" options={{ title: 'Izin Kerja Saya' }} />
      <Stack.Screen name="k3/izin-kerja-baru" options={{ title: 'Ajukan Izin Kerja' }} />
      <Stack.Screen name="k3/izin/[id]" options={{ title: 'Detail Izin Kerja' }} />
      <Stack.Screen name="k3/inspeksi-apd" options={{ title: 'Inspeksi APD' }} />
      <Stack.Screen name="pengajuan/index" options={{ title: 'Pengajuan Saya' }} />
      <Stack.Screen name="pengajuan/dinas/[id]" options={{ title: 'Detail Perjalanan Dinas' }} />
      <Stack.Screen name="penghasilan" options={{ title: 'Penghasilan Saya' }} />
      <Stack.Screen name="punch-list" options={{ title: 'Punch List Saya' }} />
      <Stack.Screen name="basis-pengetahuan" options={{ title: 'Basis Pengetahuan' }} />
      <Stack.Screen name="artikel/[id]" options={{ title: 'Artikel' }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Gerbang />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
