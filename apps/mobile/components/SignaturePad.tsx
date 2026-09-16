import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import ViewShot from 'react-native-view-shot'
import { useTheme, RADIUS } from './theme'

export type SignaturePadHandle = {
  isEmpty: () => boolean
  clear: () => void
  /** Menangkap kanvas sebagai berkas PNG lokal, siap diunggah lewat uploadFile(). */
  capture: () => Promise<string>
}

/** Kanvas tanda tangan sederhana berbasis react-native-svg + PanResponder. */
const SignaturePad = React.forwardRef<SignaturePadHandle, { height?: number }>(({ height = 200 }, ref) => {
  const t = useTheme()
  const [paths, setPaths] = useState<string[]>([])
  const current = useRef<string>('')
  const [, force] = useState(0)
  const shotRef = useRef<ViewShot>(null)

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent
          current.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`
          force((n) => n + 1)
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent
          current.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`
          force((n) => n + 1)
        },
        onPanResponderRelease: () => {
          setPaths((p) => [...p, current.current])
          current.current = ''
        },
      }),
    []
  )

  React.useImperativeHandle(ref, () => ({
    isEmpty: () => paths.length === 0,
    clear: () => {
      setPaths([])
      current.current = ''
      force((n) => n + 1)
    },
    capture: async () => {
      if (!shotRef.current?.capture) throw new Error('Kanvas tanda tangan belum siap')
      const uri = await shotRef.current.capture()
      return uri
    },
  }))

  return (
    <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={[styles.wrap, { height, borderColor: t.border }]}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#131B2C" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {current.current ? (
            <Path d={current.current} stroke="#131B2C" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
      </View>
    </ViewShot>
  )
})

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
})
