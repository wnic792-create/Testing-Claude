import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Copy, AlertTriangle } from 'lucide-react'
import { api } from '../../api/client'
import type { Category } from '../../api/types'

interface VarianceLine {
  budget_id: number
  category_id: number
  category_name: string
  category_name_fr: string | null
  category_type: string
  budgeted: number
  rollover_in: number
  effective_budget: number
  actual: number
  variance: number
  pct_used: number
  is_over: boolean
  rollover: boolean
}

interface VarianceReport {
  year_month: string
  lines: VarianceLine[]
  total_budgeted: number
  total_actual: number
  total_variance: number
}

interface BudgetEntry {
  category_id: number
  amount: string
  rollover: boolean
}

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function BudgetPage() {
  const { t, i18n } = useTranslation()
  const [month, setMonth] = useState(getCurrentMonth())
  const [categories, setCategories] = useState<Category[]>([])
  const [variance, setVariance] = useState<VarianceReport | null>(null)
  const [entries, setEntries] = useState<Record<number, BudgetEntry>>({})
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Flat list of expense categories only
  const expenseCategories = useMemo(() => {
    const flat: Category[] = []
    const addChildren = (cats: Category[]) => {
      for (const c of cats) {
        if (c.type === 'expense' && !c.is_system) {
          flat.push(c)
        }
        if (c.children) addChildren(c.children)
      }
    }
    addChildren(categories)
    return flat
  }, [categories])

  const fetchData = async () => {
    setLoading(true)
    const [cats, vr] = await Promise.all([
      api.get<Category[]>('/categories'),
      api.get<VarianceReport>(`/budgets/variance/${month}`),
    ])
    setCategories(cats)
    setVariance(vr)

    // Build entries map from existing budgets
    const map: Record<number, BudgetEntry> = {}
    for (const line of vr.lines) {
      map[line.category_id] = {
        category_id: line.category_id,
        amount: String(line.budgeted),
        rollover: line.rollover,
      }
    }
    setEntries(map)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [month])

  const handleSave = async () => {
    const items = Object.values(entries)
      .filter(e => parseFloat(e.amount) > 0)
      .map(e => ({
        category_id: e.category_id,
        amount: parseFloat(e.amount),
        rollover: e.rollover,
      }))

    await api.post(`/budgets/bulk/${month}`, items)
    setEditing(false)
    fetchData()
  }

  const handleCopyPrev = async () => {
    const prev = shiftMonth(month, -1)
    await api.post(`/budgets/copy/${prev}/${month}`, undefined)
    fetchData()
  }

  const updateEntry = (catId: number, field: 'amount' | 'rollover', value: string | boolean) => {
    setEntries(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId] || { category_id: catId, amount: '0', rollover: false },
        [field]: value,
      },
    }))
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n)

  const getCatName = (line: VarianceLine) =>
    i18n.language === 'fr' && line.category_name_fr ? line.category_name_fr : line.category_name

  const monthLabel = new Date(month + '-15').toLocaleDateString(
    i18n.language === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long' }
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('nav.budget')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyPrev} className="btn-secondary flex items-center gap-1.5 text-xs">
            <Copy size={12} />
            Copy previous month
          </button>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); fetchData() }} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleSave} className="btn-primary">{t('common.save')}</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-primary">{t('common.edit')}</button>
          )}
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-1.5 hover:bg-surface-800 rounded">
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-medium capitalize w-48 text-center">{monthLabel}</span>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-1.5 hover:bg-surface-800 rounded">
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <p className="text-surface-500">{t('common.loading')}</p>
      ) : editing ? (
        /* Edit mode: show all expense categories with inputs */
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-surface-400 uppercase border-b border-surface-700">
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 w-36">Budget</th>
                <th className="px-3 py-2 w-24 text-center">Rollover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {expenseCategories.map(cat => {
                const entry = entries[cat.id]
                const catName = i18n.language === 'fr' && cat.name_fr ? cat.name_fr : cat.name
                const isChild = cat.parent_id !== null
                return (
                  <tr key={cat.id} className={isChild ? 'bg-surface-800/30' : ''}>
                    <td className={`px-3 py-1.5 ${isChild ? 'pl-8' : 'font-medium'}`}>{catName}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={entry?.amount || ''}
                        onChange={e => updateEntry(cat.id, 'amount', e.target.value)}
                        placeholder="0"
                        className="input w-full text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={entry?.rollover || false}
                        onChange={e => updateEntry(cat.id, 'rollover', e.target.checked)}
                        className="accent-blue-500"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : variance && variance.lines.length > 0 ? (
        /* Variance view */
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-xs text-surface-400 uppercase">Budgeted</p>
              <p className="text-xl font-bold font-mono mt-1">{formatCurrency(variance.total_budgeted)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-surface-400 uppercase">Spent</p>
              <p className="text-xl font-bold font-mono text-red-400 mt-1">{formatCurrency(variance.total_actual)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-surface-400 uppercase">Remaining</p>
              <p className={`text-xl font-bold font-mono mt-1 ${variance.total_variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(variance.total_variance)}
              </p>
            </div>
          </div>

          {/* Variance table */}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-surface-400 uppercase border-b border-surface-700 bg-surface-800">
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 w-28 text-right">Budgeted</th>
                  <th className="px-4 py-2.5 w-28 text-right">Spent</th>
                  <th className="px-4 py-2.5 w-28 text-right">Remaining</th>
                  <th className="px-4 py-2.5 w-48">Progress</th>
                  <th className="px-4 py-2.5 w-16 text-center">Rollover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {variance.lines.map(line => (
                  <tr key={line.budget_id} className={`${line.is_over ? 'bg-red-500/5' : ''} hover:bg-surface-800/50`}>
                    <td className="px-4 py-2 flex items-center gap-2">
                      {line.is_over && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                      <span className={line.is_over ? 'text-red-300' : ''}>{getCatName(line)}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{formatCurrency(line.effective_budget)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-red-400">{formatCurrency(line.actual)}</td>
                    <td className={`px-4 py-2 text-right font-mono text-xs ${line.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(line.variance)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              line.pct_used > 100 ? 'bg-red-500' : line.pct_used > 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(line.pct_used, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-surface-400 w-12 text-right">{line.pct_used}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-surface-500">
                      {line.rollover ? 'Yes' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <p className="text-surface-500 mb-3">No budget set for {monthLabel}</p>
          <button onClick={() => setEditing(true)} className="btn-primary">Set up budget</button>
        </div>
      )}
    </div>
  )
}
