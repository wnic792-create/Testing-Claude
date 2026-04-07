import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, FileText, CheckCircle } from 'lucide-react'
import { api } from '../../api/client'
import type { Account, BankProfile, ImportResult } from '../../api/types'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profiles, setProfiles] = useState<BankProfile[]>([])
  const [accountId, setAccountId] = useState<string>('')
  const [profileId, setProfileId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      api.get<Account[]>('/accounts').then(setAccounts)
      api.get<BankProfile[]>('/import/profiles').then(setProfiles)
      setFile(null)
      setResult(null)
      setError(null)
    }
  }, [open])

  const handleImport = async () => {
    if (!file || !accountId) return

    setImporting(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('account_id', accountId)
    if (profileId) formData.append('bank_profile', profileId)

    const isOfx = file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx')
    const endpoint = isOfx ? '/import/ofx' : '/import/csv'

    try {
      const res = await api.upload<ImportResult>(endpoint, formData)
      setResult(res)
      onImported()
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-900 border border-surface-700 rounded-lg w-[480px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-base font-semibold">{t('common.import')} Transactions</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={20} />
                <span className="font-medium">Import complete</span>
              </div>
              <div className="text-sm space-y-1 text-surface-300">
                <p><span className="font-mono">{result.imported}</span> transactions imported</p>
                <p><span className="font-mono">{result.duplicates_skipped}</span> duplicates skipped</p>
                <p><span className="font-mono">{result.auto_categorized}</span> auto-categorized</p>
              </div>
              <button onClick={onClose} className="btn-primary w-full">{t('common.close')}</button>
            </div>
          ) : (
            <>
              {/* Account selector */}
              <div>
                <label className="block text-xs text-surface-400 mb-1.5">Account</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Bank profile */}
              <div>
                <label className="block text-xs text-surface-400 mb-1.5">Bank format (for CSV)</label>
                <select
                  value={profileId}
                  onChange={e => setProfileId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Auto-detect / OFX</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* File drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-surface-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.ofx,.qfx"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-surface-200">
                    <FileText size={16} />
                    <span className="text-sm">{file.name}</span>
                  </div>
                ) : (
                  <div className="text-surface-500">
                    <Upload size={24} className="mx-auto mb-2" />
                    <p className="text-sm">Drop CSV, OFX, or QFX file here</p>
                    <p className="text-xs mt-1">or click to browse</p>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                onClick={handleImport}
                disabled={!file || !accountId || importing}
                className="btn-primary w-full disabled:opacity-50"
              >
                {importing ? 'Importing...' : t('common.import')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
