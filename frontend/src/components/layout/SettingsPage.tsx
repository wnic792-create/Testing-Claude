import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload, Sun, Moon } from 'lucide-react'
import { useThemeStore } from '../../stores/theme'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { isDark, toggle } = useThemeStore()
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)

  const handleBackup = () => {
    window.open('/api/backup/export', '_blank')
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoring(true)
    setRestoreMsg(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/backup/import', { method: 'POST', body: formData })
      const data = await res.json()
      setRestoreMsg(data.message || 'Restore complete. Restart the backend.')
    } catch {
      setRestoreMsg('Restore failed.')
    }
    setRestoring(false)
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">{t('nav.settings')}</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-4">Appearance</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Theme</span>
              <button onClick={toggle} className="btn-secondary flex items-center gap-2">
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                {isDark ? 'Switch to Light' : 'Switch to Dark'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Language</span>
              <div className="flex gap-1">
                <button
                  onClick={() => i18n.changeLanguage('en')}
                  className={`px-3 py-1.5 text-xs rounded-md ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-surface-800 text-surface-400'}`}
                >
                  English
                </button>
                <button
                  onClick={() => i18n.changeLanguage('fr')}
                  className={`px-3 py-1.5 text-xs rounded-md ${i18n.language === 'fr' ? 'bg-blue-600 text-white' : 'bg-surface-800 text-surface-400'}`}
                >
                  Français
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-4">Backup & Restore</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Export database</p>
                <p className="text-xs text-surface-500">Download the entire SQLite database as a single file</p>
              </div>
              <button onClick={handleBackup} className="btn-secondary flex items-center gap-2">
                <Download size={14} />
                {t('common.export')}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Restore database</p>
                <p className="text-xs text-surface-500">Upload a backup file to replace the current database</p>
              </div>
              <label className="btn-secondary flex items-center gap-2 cursor-pointer">
                <Upload size={14} />
                {restoring ? 'Restoring...' : t('common.import')}
                <input type="file" accept=".db" className="hidden" onChange={handleRestore} disabled={restoring} />
              </label>
            </div>
            {restoreMsg && <p className="text-xs text-yellow-400">{restoreMsg}</p>}
          </div>
        </div>

        {/* Data Info */}
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-4">Data</h2>
          <div className="space-y-2 text-sm text-surface-400">
            <p>Database location: <code className="text-surface-300 bg-surface-800 px-1.5 py-0.5 rounded text-xs">data/finance.db</code></p>
            <p>Tax brackets: <code className="text-surface-300 bg-surface-800 px-1.5 py-0.5 rounded text-xs">backend/seed/tax_config_2025.json</code></p>
            <p>Bank mappings: <code className="text-surface-300 bg-surface-800 px-1.5 py-0.5 rounded text-xs">backend/seed/bank_csv_templates.json</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
