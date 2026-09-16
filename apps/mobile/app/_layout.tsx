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
