import React from 'react'

/** Menangkap galat render agar pengguna melihat pesan, bukan layar putih. */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: any) { console.error('[NUSAKARYA]', error, info) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24,
                    background: '#F4F4F6', fontFamily: 'system-ui, sans-serif', color: '#1A1A24' }}>
        <div style={{ maxWidth: 560, background: '#fff', borderRadius: 14, padding: 28,
                      boxShadow: '0 4px 16px rgba(23,23,40,.07)' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Aplikasi gagal dimuat</h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: '#525260' }}>
            Terjadi galat saat menampilkan halaman. Muat ulang halaman ini; bila masih terjadi,
            sampaikan pesan di bawah kepada administrator.
          </p>
          <pre style={{ marginTop: 14, padding: 12, background: '#F4F4F6', borderRadius: 10,
                        fontSize: 12, whiteSpace: 'pre-wrap', color: '#E11D48', overflow: 'auto' }}>
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button onClick={() => location.reload()}
            style={{ marginTop: 16, height: 40, padding: '0 18px', borderRadius: 10, border: 0,
                     background: '#4F46E5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Muat ulang
          </button>
        </div>
      </div>)
  }
}
