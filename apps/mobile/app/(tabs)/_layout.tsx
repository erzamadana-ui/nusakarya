import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/components/theme'

export default function TabsLayout() {
  const t = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.dark },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tugas"
        options={{
          title: 'Tugas',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tiket"
        options={{
          title: 'Tiket',
          tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="material"
        options={{
          title: 'Material',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
