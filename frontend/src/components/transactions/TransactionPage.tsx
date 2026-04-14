import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Download, Wand2 } from 'lucide-react'
import TransactionList from './TransactionList'
import ImportDialog from './ImportDialog'
import { api } from '../../api/client'

export default function TransactionPage() {
  const { t } = useTranslation()
  const [importOpen, setImportOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleImported = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const handleRecategorize = async () => {
    const result = await api.post<{ categorized: number; checked: number }>(
      '/transactions/categorize-uncategorized',
    )
    alert(
      t('transactions.recategorizeResult', {
        categorized: result.categorized,
        checked: result.checked,
        defaultValue: `Categorized ${result.categorized} of ${result.checked} uncategorized transactions.`,
      }),
    )
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
        <h1 className="text-xl font-semibold">{t('nav.transactions')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRecategorize}
            className="btn-secondary flex items-center gap-2"
            title={t('transactions.recategorize') || 'Auto-categorize uncategorized transactions'}
          >
            <Wand2 size={14} />
            {t('transactions.recategorize') || 'Recategorize'}
          </button>
          <a
            href="/api/import/export/csv"
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={14} />
            {t('common.export')}
          </a>
          <button
            onClick={() => setImportOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Upload size={14} />
            {t('common.import')}
          </button>
        </div>
      </div>

      <TransactionList key={refreshKey} />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </div>
  )
}
