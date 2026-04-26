import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Play, SkipForward, Pause, CheckCircle, X } from 'lucide-react'
import { api } from '../../api/client'
import type { Account, Category } from '../../api/types'

interface RecurringRule {
  id: number
  account_id: number
  description: string
  amount: number
  currency: string
  category_id: number | null
  frequency: string
  start_date: string
  end_date: string | null
  next_date: string
  is_active: boolean
  notes: string | null
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n)

const shortDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [lastResult, setLastResult] = useState<{ created: number } | null>(null)

  const [form, setForm] = useState({
    account_id: '',
    description: '',
    amount: '',
    category_id: '',
    frequency: 'monthly',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    notes: '',
  })

  const refresh = useCallback(() => {
    api.get<RecurringRule[]>('/recurring').then(setRules)
  }, [])

  useEffect(() => {
    refresh()
    api.get<Account[]>('/accounts').then(setAccounts)
    api.get<Category[]>('/categories/flat').then(setCategories)
  }, [refresh])

  const acctName = (id: number) => accounts.find(a => a.id === id)?.name ?? '—'
  const catName = (id: number | null) => {
    if (!id) return '—'
    const c = categories.find(x => x.id === id)
    return c?.name ?? '—'
  }

  const handleCreate = async () => {
    if (!form.account_id || !form.description || !form.amount) return
    await api.post('/recurring', {
      account_id: Number(form.account_id),
      description: form.description,
      amount: Number(form.amount),
      category_id: form.category_id ? Number(form.category_id) : null,
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes || null,
    })
    setForm({ account_id: '', description: '', amount: '', category_id: '', frequency: 'monthly', start_date: new Date().toISOString().slice(0, 10), end_date: '', notes: '' })
    setShowForm(false)
    refresh()
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/recurring/${id}`)
    refresh()
  }

  const handleToggle = async (rule: RecurringRule) => {
    await api.patch(`/recurring/${rule.id}`, { is_active: !rule.is_active })
    refresh()
  }

  const handleSkip = async (id: number) => {
    await api.post(`/recurring/${id}/skip`)
    refresh()
  }

  const handleExecute = async () => {
    setExecuting(true)
    setLastResult(null)
    try {
      const res = await api.post<{ created: number }>('/recurring/execute')
      setLastResult(res)
      refresh()
    } finally {
      setExecuting(false)
    }
  }

  const activeRules = rules.filter(r => r.is_active)
  const pausedRules = rules.filter(r => !r.is_active)
  const dueCount = rules.filter(r => r.is_active && r.next_date <= new Date().toISOString().slice(0, 10)).length
  const monthlyEstimate = rules.filter(r => r.is_active).reduce((sum, r) => {
    const amt = Math.abs(r.amount)
    switch (r.frequency) {
      case 'weekly': return sum + amt * 52 / 12
      case 'biweekly': return sum + amt * 26 / 12
      case 'monthly': return sum + amt
      case 'quarterly': return sum + amt / 3
      case 'annual': return sum + amt / 12
      default: return sum + amt
    }
  }, 0)

  const parentCategories = categories.filter(c => !c.parent_id)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recurring Transactions</h1>
          <p className="text-xs text-surface-500 mt-0.5">
            {activeRules.length} active rule{activeRules.length !== 1 ? 's' : ''}
            {dueCount > 0 && <span className="text-amber-400 ml-1">· {dueCount} due today</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExecute} disabled={executing || dueCount === 0}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <Play size={13} />
            {executing ? 'Running…' : `Execute due (${dueCount})`}
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
            {showForm ? <X size={13} /> : <Plus size={13} />}
            {showForm ? 'Cancel' : 'New rule'}
          </button>
        </div>
      </div>

      {/* Execution result banner */}
      {lastResult && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-green-800/40 bg-green-900/20 text-green-400 text-sm">
          <CheckCircle size={15} />
          <span>{lastResult.created} transaction{lastResult.created !== 1 ? 's' : ''} created from recurring rules.</span>
          <button onClick={() => setLastResult(null)} className="ml-auto text-surface-400 hover:text-surface-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 uppercase tracking-wide">Active Rules</p>
          <p className="text-lg font-bold font-mono mt-0.5">{activeRules.length}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 uppercase tracking-wide">Due Today</p>
          <p className={`text-lg font-bold font-mono mt-0.5 ${dueCount > 0 ? 'text-amber-400' : 'text-surface-300'}`}>{dueCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 uppercase tracking-wide">Est. Monthly</p>
          <p className="text-lg font-bold font-mono mt-0.5 text-red-400">{fmt(-monthlyEstimate)}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 uppercase tracking-wide">Paused</p>
          <p className="text-lg font-bold font-mono mt-0.5 text-surface-500">{pausedRules.length}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-4">New Recurring Transaction</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Account</label>
              <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="input w-full">
                <option value="">Select account…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input w-full" placeholder="e.g. Netflix, Rent, Gym" />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Amount (negative = expense)</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input w-full font-mono" placeholder="-18.99" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="input w-full">
                {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">End date (optional)</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Category</label>
              <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="input w-full">
                <option value="">None</option>
                {parentCategories.map(p => (
                  <optgroup key={p.id} label={p.name}>
                    {categories.filter(c => c.parent_id === p.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-surface-400 mb-1">Notes (optional)</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input w-full" placeholder="Optional notes" />
          </div>
          <button onClick={handleCreate} disabled={!form.account_id || !form.description || !form.amount}
            className="btn-primary text-xs">
            Create recurring rule
          </button>
        </div>
      )}

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-surface-400 font-medium mb-1">No recurring transactions yet</p>
          <p className="text-surface-500 text-sm">Click "New rule" to set up your first recurring transaction.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-surface-500 border-b border-surface-700 bg-surface-800/30">
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Frequency</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Next Date</th>
                  <th className="px-4 py-2.5 font-medium">End Date</th>
                  <th className="px-4 py-2.5 font-medium text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/60">
                {rules.map(rule => {
                  const isDue = rule.is_active && rule.next_date <= new Date().toISOString().slice(0, 10)
                  return (
                    <tr key={rule.id} className={`transition-colors ${!rule.is_active ? 'opacity-50' : isDue ? 'bg-amber-900/10' : 'hover:bg-surface-800/30'}`}>
                      <td className="px-4 py-2.5">
                        {!rule.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-700 text-surface-400">
                            <Pause size={10} /> Paused
                          </span>
                        ) : isDue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-900/30 text-amber-400 border border-amber-800/40">
                            Due
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-800/40">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-surface-200">{rule.description}</p>
                        {rule.notes && <p className="text-[10px] text-surface-500 mt-0.5">{rule.notes}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-surface-400">{acctName(rule.account_id)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${rule.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(rule.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-surface-300">{FREQ_LABELS[rule.frequency] ?? rule.frequency}</td>
                      <td className="px-4 py-2.5 text-surface-400">{catName(rule.category_id)}</td>
                      <td className={`px-4 py-2.5 font-mono ${isDue ? 'text-amber-400 font-semibold' : 'text-surface-300'}`}>
                        {shortDate(rule.next_date)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-surface-500">
                        {rule.end_date ? shortDate(rule.end_date) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSkip(rule.id)} title="Skip next"
                            className="p-1 text-surface-500 hover:text-blue-400 transition-colors">
                            <SkipForward size={13} />
                          </button>
                          <button onClick={() => handleToggle(rule)} title={rule.is_active ? 'Pause' : 'Resume'}
                            className="p-1 text-surface-500 hover:text-amber-400 transition-colors">
                            {rule.is_active ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button onClick={() => handleDelete(rule.id)} title="Delete"
                            className="p-1 text-surface-500 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
