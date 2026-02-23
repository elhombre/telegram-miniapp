'use client'

import { DashboardShell } from '@/components/app/dashboard-shell'
import { useI18n } from '@/components/app/i18n-provider'
import { NotesPanel } from '@/components/app/notes-panel'

export default function DashboardNotesPage() {
  const { t } = useI18n()

  return (
    <DashboardShell title={t('notes.title')} subtitle={t('notes.subtitle')}>
      <NotesPanel />
    </DashboardShell>
  )
}
