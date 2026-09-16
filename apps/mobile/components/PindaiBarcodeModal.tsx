import React, { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from './theme'

/** Modal pemindai barcode/QR nomor seri perangkat memakai expo-camera. */
export default function PindaiBarcodeModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean
  onClose: () => void
  onScanned: (kode: string) => void
}) {
  const t = useTheme()
  const [izin, requestIzin] = useCameraPermissions()
  const [terkunci, setTerkunci] = useState(false)

  useEffect(() => {
    if (visible) {
      setTerkunci(false)
      if (!izin?.granted) requestIzin()
    }
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {izin?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'qr', 'ean13', 'ean8', 'upc_a'] }}
            onBarcodeScanned={(res) => {
              if (terkunci) return
              setTerkunci(true)
              onScanned(res.data)
            }}
          />
        ) : (
          <View style={styles.center}>
            <Text style={{ color: '#FFF', fontSize: 16, textAlign: 'center', paddingHorizontal: 24 }}>
              Izin kamera diperlukan untuk memindai nomor seri.
            </Text>
          </View>
        )}
        <View style={styles.overlayTop}>
          <View style={[styles.frame, { borderColor: t.aksen }]} />
          <Text style={styles.hint}>Arahkan kamera ke barcode/QR nomor seri NTE</Text>
        </View>
        <Pressable style={[styles.tutup, { backgroundColor: t.dark }]} onPress={onClose}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Tutup</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 60, gap: 14 },
  frame: { width: 240, height: 150, borderWidth: 3, borderRadius: RADIUS },
  hint: { color: '#FFFFFF', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tutup: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
})
