import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Download, Wand2, Zap, Plus, X } from 'lucide-react'
import TransactionList from './TransactionList'
import ImportDialog from './ImportDialog'
import { api } from '../../api/client'
import type { Account, Category } from '../../api/types'
import { useProfileStore } from '../../stores/profile'

const EMPTY_FORM = {
  account_id: '',
  to_account_id: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  amount: '',
  category_id: '',
  notes: '',
}

export default function TransactionPage() {
  const { t, i18n } = useTranslation()
  const [importOpen, setImportOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)

  const activeProfileId = useProfileStore(s => s.activeProfileId)

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts)
    api.get<Category[]>('/categories/flat').then(setCategories)
    setRefreshKey(k => k + 1)
  }, [activeProfileId])

  const handleImported = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const selectedCategory = categories.find(c => c.id === Number(form.category_id))
  const isTransfer = selectedCategory?.is_transfer_category ?? false

  const handleSubmit = async () => {
    if (!form.account_id || !form.date || !form.description || !form.amount) return
    setSaving(true)
    try {
      if (isTransfer) {
        if (!form.to_account_id) {
          alert('Please select a destination account for this transfer.')
          return
        }
        await api.post('/transactions/transfer', {
          from_account_id: Number(form.account_id),
          to_account_id: Number(form.to_account_id),
          date: form.date,
          description: form.description,
          amount: Math.abs(Number(form.amount)),
          category_id: form.category_id ? Number(form.category_id) : null,
          notes: form.notes || null,
        })
      } else {
        await api.post('/transactions', {
          account_id: Number(form.account_id),
          date: form.date,
          description: form.description,
          amount: Number(form.amount),
          category_id: form.category_id ? Number(form.category_id) : null,
          notes: form.notes || null,
        })
      }
      setForm(EMPTY_FORM)
      setShowForm(false)
      setRefreshKey(k => k + 1)
    } finally {
      setSaving(false)
    }
  }

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

  const handleForceRecategorize = async () => {
    const msg =
      'Recategorize ALL transactions using current rule priorities? ' +
      'This will overwrite existing categories on any transaction that now matches a different rule.'
    if (!confirm(msg)) return
    const result = await api.post<{ categorized: number; checked: number }>(
      '/transactions/recategorize-all',
    )
    alert(`Changed category on ${result.categorized} of ${result.checked} transactions.`)
    setRefreshKey(k => k + 1)
  }

  const getCategoryLabel = (cat: Category) =>
    i18n.language === 'fr' && cat.name_fr ? cat.name_fr : cat.name

  // Group categories by parent for the <select> optgroup display
  const parentCats = categories.filter(c => c.parent_id === null)
  const childrenOf = (parentId: number) => categories.filter(c => c.parent_id === parentId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
        <h1 className="text-xl font-semibold">{t('nav.transactions')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(v => !v)}
            className="btn-primary flex items-center gap-2"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Add'}
          </button>
          <button
            onClick={handleRecategorize}
            className="btn-secondary flex items-center gap-2"
            title="Auto-categorize only transactions that currently have no category"
          >
            <Wand2 size={14} />
            {t('transactions.recategorize') || 'Recategorize'}
          </button>
          <button
            onClick={handleForceRecategorize}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-amber-700 text-amber-400 hover:bg-amber-900/30 transition-colors"
            title="Re-run all rules in priority order and overwrite existing categories"
          >
            <Zap size={14} />
            Recategorize all
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
            className="btn-secondary flex items-center gap-2"
          >
            <Upload size={14} />
            {t('common.import')}
          </button>
        </div>
      </div>

      {/* Add Transaction form */}
      {showForm && (
        <div className="px-6 py-4 border-b border-surface-700 bg-surface-900/60">
          <div className="grid grid-cols-6 gap-3 items-end">
            {/* From account */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-surface-400">Account</label>
              <select
                value={form.account_id}
                onChange={e => setForm({ ...form, account_id: e.target.value })}
                className="input"
              >
                <option value="">Select…</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-surface-400">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="input"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-surface-400">Description</label>
              <input
                type="text"
                placeholder="Description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="input"
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-surface-400">
                Amount {isTransfer ? '(positive)' : '(- = expense)'}
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={isTransfer ? '0.00' : '-50.00'}
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="input"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-surface-400">Category</label>
              <select
                value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value, to_account_id: '' })}
                className="input"
              >
                <option value="">None</option>
                {parentCats.map(parent => {
                  const children = childrenOf(parent.id)
                  if (children.length === 0) {
                    return (
                      <option key={parent.id} value={parent.id}>
                        {getCategoryLabel(parent)}
                      </option>
                    )
                  }
                  return (
                    <optgroup key={parent.id} label={getCategoryLabel(parent)}>
                      {children.map(child => (
                        <option key={child.id} value={child.id}>
                          {getCategoryLabel(child)}
                          {child.is_transfer_category ? ' →' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {/* To account (conditional) or Save button */}
            {isTransfer ? (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-surface-400 text-blue-400">To account</label>
                  <select
                    value={form.to_account_id}
                    onChange={e => setForm({ ...form, to_account_id: e.target.value })}
                    className="input border-blue-700 focus:border-blue-500"
                  >
                    <option value="">Select…</option>
                    {accounts
                      .filter(a => String(a.id) !== form.account_id)
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                  </select>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.account_id || !form.to_account_id || !form.description || !form.amount}
                  className="btn-primary self-end disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save Transfer'}
                </button>
              </>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving || !form.account_id || !form.description || !form.amount}
                className="btn-primary self-end disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>

          {isTransfer && (
            <p className="mt-2 text-xs text-blue-400/70">
              Transfer: money moves out of <strong>{accounts.find(a => String(a.id) === form.account_id)?.name || '…'}</strong> and into the destination account. Both balances update automatically.
            </p>
          )}
        </div>
      )}

      <TransactionList key={refreshKey} />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </div>
  )
}
