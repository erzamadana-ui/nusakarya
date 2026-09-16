import * as Location from 'expo-location'

export type Koordinat = { lat: number; lng: number }

/** Minta izin lokasi (jika belum) lalu ambil posisi terkini dengan akurasi tinggi. */
export async function ambilLokasi(): Promise<Koordinat> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Izin lokasi ditolak. Aktifkan izin lokasi untuk melanjutkan.')
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
  return { lat: pos.coords.latitude, lng: pos.coords.longitude }
}

export function bukaGoogleMaps(lat?: number | null, lng?: number | null, label?: string) {
  if (lat == null || lng == null) return null
  const q = encodeURIComponent(label ?? `${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${q}`
}
