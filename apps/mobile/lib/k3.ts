/** Konstanta & helper untuk fitur K3 (Kesehatan, Keselamatan Kerja). */

export const JENIS_INSIDEN: { value: string; label: string }[] = [
  { value: 'nearmiss', label: 'Nyaris Celaka (Near Miss)' },
  { value: 'ringan', label: 'Cedera Ringan' },
  { value: 'sedang', label: 'Cedera Sedang' },
  { value: 'berat', label: 'Cedera Berat' },
  { value: 'fatal', label: 'Fatal' },
  { value: 'kerusakan_aset', label: 'Kerusakan Aset/Properti' },
]

export type ChecklistTemplateItem = { label: string }

export const JENIS_IZIN_KERJA: { value: string; label: string; checklist: ChecklistTemplateItem[] }[] = [
  {
    value: 'umum',
    label: 'Izin Kerja Umum',
    checklist: [
      { label: 'Area kerja sudah diberi rambu/barikade' },
      { label: 'APD standar (helm, sepatu, rompi) sudah dipakai' },
      { label: 'Rekan kerja/pengawas mengetahui lokasi & rencana kerja' },
      { label: 'Kotak P3K tersedia di lokasi' },
    ],
  },
  {
    value: 'ketinggian',
    label: 'Bekerja di Ketinggian',
    checklist: [
      { label: 'Sertifikat kerja di ketinggian masih berlaku' },
      { label: 'Full body harness & lanyard diperiksa layak pakai' },
      { label: 'Titik anchor/pengait sudah diperiksa kekuatannya' },
      { label: 'Tangga/tiang dalam kondisi baik dan stabil' },
      { label: 'Cuaca memungkinkan (tidak hujan/petir/angin kencang)' },
      { label: 'Pengawas berada di lokasi selama pekerjaan' },
    ],
  },
  {
    value: 'panas',
    label: 'Pekerjaan Panas (Hot Work)',
    checklist: [
      { label: 'Area bebas dari bahan mudah terbakar dalam radius aman' },
      { label: 'Alat pemadam api ringan (APAR) tersedia di lokasi' },
      { label: 'Fire watch/pengawas kebakaran ditunjuk' },
      { label: 'APD tahan panas (sarung tangan, kacamata las) dipakai' },
    ],
  },
  {
    value: 'ruang_terbatas',
    label: 'Ruang Terbatas (Confined Space)',
    checklist: [
      { label: 'Ventilasi/sirkulasi udara sudah diperiksa' },
      { label: 'Alat deteksi gas tersedia dan berfungsi' },
      { label: 'Ada personel standby di luar ruang terbatas' },
      { label: 'Jalur evakuasi darurat sudah dipastikan aman' },
    ],
  },
  {
    value: 'listrik',
    label: 'Pekerjaan Kelistrikan',
    checklist: [
      { label: 'Sumber listrik sudah dipastikan mati (LOTO) bila perlu' },
      { label: 'Alat ukur tegangan tersedia dan berfungsi' },
      { label: 'APD isolasi listrik (sarung tangan khusus) dipakai' },
      { label: 'Area kerja kering, tidak ada genangan air' },
    ],
  },
  {
    value: 'galian',
    label: 'Pekerjaan Galian',
    checklist: [
      { label: 'Lokasi utilitas bawah tanah (kabel/pipa) sudah dicek' },
      { label: 'Area galian diberi barikade/rambu peringatan' },
      { label: 'Dinding galian aman dari longsor' },
    ],
  },
]

export function templateIzin(jenis: string) {
  return JENIS_IZIN_KERJA.find((j) => j.value === jenis) ?? JENIS_IZIN_KERJA[0]
}

export const ITEM_INSPEKSI_APD: { key: string; label: string }[] = [
  { key: 'helm', label: 'Helm Keselamatan (Safety Helmet)' },
  { key: 'harness', label: 'Sabuk Pengaman / Full Body Harness' },
  { key: 'sarung_tangan', label: 'Sarung Tangan Kerja' },
  { key: 'sepatu', label: 'Sepatu Keselamatan (Safety Shoes)' },
  { key: 'rompi', label: 'Rompi Keselamatan (Safety Vest)' },
  { key: 'tangga', label: 'Kondisi Tangga' },
]

export function hasilInspeksi(skor: number): { label: string; kunci: 'aman' | 'perlu_perbaikan' | 'tidak_aman' } {
  if (skor >= 90) return { label: 'Aman', kunci: 'aman' }
  if (skor >= 70) return { label: 'Perlu Perbaikan', kunci: 'perlu_perbaikan' }
  return { label: 'Tidak Aman', kunci: 'tidak_aman' }
}
