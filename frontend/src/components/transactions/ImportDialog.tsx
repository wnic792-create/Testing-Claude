import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, FileText, CheckCircle, AlertTriangle } from 'lucide-react'
import { api } from '../../api/client'
import type {
  Account,
  BankProfile,
  ImportDuplicate,
  ImportResult,
} from '../../api/types'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface ForceImportResponse {
  imported: number
  auto_transferred?: number
  filename: string | null
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
  const [dupSelected, setDupSelected] = useState<Set<number>>(new Set())
  const [forcing, setForcing] = useState(false)
  const [forceResult, setForceResult] = useState<ForceImportResponse | null>(null)

  useEffect(() => {
    if (open) {
      api.get<Account[]>('/accounts').then(setAccounts)
      api.get<BankProfile[]>('/import/profiles').then(setProfiles)
      setFile(null)
      setResult(null)
      setError(null)
      setDupSelected(new Set())
      setForceResult(null)
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
      setDupSelected(new Set())
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

  const toggleDup = (idx: number) => {
    setDupSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAllDups = (dups: ImportDuplicate[]) => {
    setDupSelected(prev => {
      if (prev.size === dups.length) return new Set()
      return new Set(dups.map((_, i) => i))
    })
  }

  const handleForceImport = async () => {
    if (!result || !result.duplicates || dupSelected.size === 0) return
    setForcing(true)
    setError(null)
    try {
      const payload = {
        account_id: Number(accountId),
        filename: result.filename,
        transactions: Array.from(dupSelected).map(i => {
          const d = result.duplicates![i].incoming
          return {
            date: d.date,
            description: d.description,
            amount: d.amount,
            currency: d.currency,
            import_hash: d.import_hash,
          }
        }),
      }
      const res = await api.post<ForceImportResponse>('/import/force-import', payload)
      setForceResult(res)
      onImported()
    } catch (e: any) {
      setError(e.message || 'Force-import failed')
    } finally {
      setForcing(false)
    }
  }

  const fmtAmount = (amount: number, currency?: string) => {
    const sign = amount < 0 ? '-' : ''
    return `${sign}${Math.abs(amount).toFixed(2)} ${currency || ''}`.trim()
  }

  if (!open) return null

  const duplicates = result?.duplicates ?? []
  const hasDuplicates = duplicates.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-900 border border-surface-700 rounded-lg w-[560px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-base font-semibold">{t('common.import')} Transactions</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <CheckCircle size={20} />
                <span className="font-medium">Import complete</span>
              </div>
              <div className="text-sm space-y-1 text-surface-300">
                <p><span className="font-mono">{result.imported}</span> transactions imported</p>
                <p><span className="font-mono">{result.duplicates_skipped}</span> duplicates skipped</p>
                <p><span className="font-mono">{result.auto_categorized}</span> auto-categorized</p>
                {(result.auto_transferred ?? 0) > 0 && (
                  <p className="text-accent">
                    <span className="font-mono">{result.auto_transferred}</span> auto-paired as transfers
                  </p>
                )}
                {forceResult && (
                  <p className="text-amber-400">
                    <span className="font-mono">{forceResult.imported}</span> duplicate(s) force-imported
                  </p>
                )}
              </div>

              {hasDuplicates && !forceResult && (
                <div className="border border-amber-700/40 bg-amber-900/10 rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle size={16} />
                      <span className="font-medium text-sm">
                        {duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'} detected
                      </span>
                    </div>
                    <button
                      onClick={() => toggleAllDups(duplicates)}
                      className="text-xs text-surface-400 hover:text-surface-200 underline"
                    >
                      {dupSelected.size === duplicates.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <p className="text-xs text-surface-400">
                    These were skipped because they match existing rows. Tick any you want to import anyway.
                  </p>
                  <div className="space-y-2 max-h-[280px] overflow-auto">
                    {duplicates.map((d, i) => {
                      const checked = dupSelected.has(i)
                      return (
                        <label
                          key={i}
                          className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-colors ${
                            checked
                              ? 'border-amber-600 bg-amber-900/20'
                              : 'border-surface-700 hover:border-surface-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleDup(i)}
                          />
                          <div className="flex-1 text-xs space-y-1.5 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-surface-200 font-medium truncate">
                                {d.incoming.description}
                              </span>
                              <span
                                className={`font-mono shrink-0 ${
                                  d.incoming.amount < 0 ? 'text-negative' : 'text-accent'
                                }`}
                              >
                                {fmtAmount(d.incoming.amount, d.incoming.currency)}
                              </span>
                            </div>
                            <div className="text-surface-500">
                              Incoming: {d.incoming.date}
                            </div>
                            {d.existing ? (
                              <div className="text-surface-500 border-t border-surface-700/60 pt-1.5">
                                Matches existing #{d.existing.id} · {d.existing.date} ·{' '}
                                <span className="font-mono">
                                  {fmtAmount(d.existing.amount, d.existing.currency)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-surface-500 border-t border-surface-700/60 pt-1.5">
                                Duplicate within this file (appears more than once)
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {error && <p className="text-negative text-sm">{error}</p>}
                  <button
                    onClick={handleForceImport}
                    disabled={dupSelected.size === 0 || forcing}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {forcing
                      ? 'Importing...'
                      : `Import ${dupSelected.size} selected duplicate${dupSelected.size === 1 ? '' : 's'}`}
                  </button>
                </div>
              )}

              <button onClick={onClose} className="btn-secondary w-full">{t('common.close')}</button>
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
                <p className="text-negative text-sm">{error}</p>
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
