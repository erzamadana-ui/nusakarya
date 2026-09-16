import React from 'react'
import { PageHeader, Card, EmptyState } from '@/components/ui'
export default function Soon({ title, note }: any) {
  return <><PageHeader title={title} />
    <Card><EmptyState title="Modul sedang dibangun" message={note ?? 'Halaman ini akan aktif pada rilis berikutnya.'} /></Card></>
}
