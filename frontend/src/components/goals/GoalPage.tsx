import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Target, CheckCircle, Clock } from 'lucide-react'
import { api } from '../../api/client'
import type { Scenario, Goal, Account } from '../../api/types'
import { useProfileStore } from '../../stores/profile'

const GOAL_TYPES = [
  { value: 'lump_sum', label: 'Lump Sum (e.g. down payment)' },
  { value: 'months_expenses', label: 'Months of Expenses (e.g. emergency fund)' },
  { value: 'fire_number', label: 'FIRE Number (retirement target)' },
]

interface ForecastMonth {
  month: number
  date_label: string
  net_worth: number
  balances: Record<number, number>
}

interface ForecastResult {
  months: ForecastMonth[]
}

export default function GoalPage() {
  const { t, i18n } = useTranslation()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: '', target_amount: 0, type: 'lump_sum',
    months_expenses: 6, linked_account_id: '', target_date: '',
  })

  const activeProfileId = useProfileStore(s => s.activeProfileId)

  useEffect(() => {
    api.get<Scenario[]>('/scenarios').then(s => {
      setScenarios(s)
      if (s.length > 0) setSelectedScenario(s[0].id)
    })
    api.get<Account[]>('/accounts').then(setAccounts)
  }, [activeProfileId])

  useEffect(() => {
    if (selectedScenario) {
      api.get<Goal[]>(`/goals?scenario_id=${selectedScenario}`).then(setGoals)
      api.get<ForecastResult>(`/forecast/${selectedScenario}?granularity=monthly`)
        .then(setForecast)
        .catch(() => setForecast(null))
    }
  }, [selectedScenario])

  const handleAdd = async () => {
    await api.post('/goals', {
      scenario_id: selectedScenario,
      name: form.name,
      target_amount: form.type === 'months_expenses' ? null : form.target_amount,
      type: form.type,
      months_expenses: form.type === 'months_expenses' ? form.months_expenses : null,
      linked_account_id: form.linked_account_id ? Number(form.linked_account_id) : null,
      target_date: form.target_date || null,
    })
    setAdding(false)
    setForm({ name: '', target_amount: 0, type: 'lump_sum', months_expenses: 6, linked_account_id: '', target_date: '' })
    api.get<Goal[]>(`/goals?scenario_id=${selectedScenario}`).then(setGoals)
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/goals/${id}`)
    api.get<Goal[]>(`/goals?scenario_id=${selectedScenario}`).then(setGoals)
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
    }).format(n)

  const getGoalProgress = (goal: Goal) => {
    if (!forecast || !forecast.months.length) return null

    // Determine current value
    let currentValue = 0
    const firstMonth = forecast.months[0]
    if (goal.linked_account_id && firstMonth.balances) {
      currentValue = firstMonth.balances[goal.linked_account_id] || 0
    } else {
      currentValue = firstMonth.net_worth
    }

    // Determine target
    let target = goal.target_amount || 0
    if (goal.type === 'months_expenses') {
      const avgExpenses = forecast.months.slice(0, 12).reduce((s, m) => {
        const expenses = Object.values(m.balances || {}).reduce((a, b) => a + b, 0)
        return s
      }, 0)
      target = (goal.months_expenses || 6) * 3000 // fallback estimate
    }

    if (target <= 0) return null

    // Find projected hit month
    let hitMonth: string | null = null
    for (const m of forecast.months) {
      let value = 0
      if (goal.linked_account_id && m.balances) {
        value = m.balances[goal.linked_account_id] || 0
      } else {
        value = m.net_worth
      }
      if (value >= target) {
        hitMonth = m.date_label
        break
      }
    }

    const pct = Math.min(100, (currentValue / target) * 100)

    return { currentValue, target, pct, hitMonth }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{t('nav.goals')}</h1>
          {scenarios.length > 0 && (
            <select
              value={selectedScenario || ''}
              onChange={e => setSelectedScenario(Number(e.target.value))}
              className="input"
            >
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          Add goal
        </button>
      </div>

      {adding && (
        <div className="card mb-6">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input placeholder="Goal name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
              {GOAL_TYPES.map(gt => <option key={gt.value} value={gt.value}>{gt.label}</option>)}
            </select>
            {form.type === 'months_expenses' ? (
              <input type="number" placeholder="Months" value={form.months_expenses} onChange={e => setForm({ ...form, months_expenses: Number(e.target.value) })} className="input" />
            ) : (
              <input type="number" placeholder="Target amount" value={form.target_amount || ''} onChange={e => setForm({ ...form, target_amount: Number(e.target.value) })} className="input" />
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select value={form.linked_account_id} onChange={e => setForm({ ...form, linked_account_id: e.target.value })} className="input">
              <option value="">Track against: Net Worth</option>
              {accounts.filter(a => a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} className="input" placeholder="Target date (optional)" />
            <button onClick={handleAdd} disabled={!form.name} className="btn-primary">{t('common.save')}</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card text-center py-12">
          <Target size={32} className="mx-auto text-surface-500 mb-3" />
          <p className="text-surface-500">No goals yet. Add a financial target to track your progress.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const progress = getGoalProgress(goal)
            return (
              <div key={goal.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      {progress && progress.pct >= 100 ? (
                        <CheckCircle size={14} className="text-accent" />
                      ) : (
                        <Target size={14} className="text-accent" />
                      )}
                      {goal.name}
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {GOAL_TYPES.find(gt => gt.value === goal.type)?.label}
                      {goal.target_date && ` · Target: ${goal.target_date}`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(goal.id)} className="text-surface-500 hover:text-negative">
                    <Trash2 size={14} />
                  </button>
                </div>

                {progress && (
                  <>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-surface-400">
                        {formatCurrency(progress.currentValue)} of {formatCurrency(progress.target)}
                      </span>
                      <span className="font-mono">{progress.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-surface-700 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress.pct >= 100 ? 'bg-accent' : progress.pct > 50 ? 'bg-accent' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(progress.pct, 100)}%` }}
                      />
                    </div>
                    {progress.hitMonth ? (
                      <p className="text-xs text-accent flex items-center gap-1">
                        <CheckCircle size={12} />
                        Projected to hit target by {progress.hitMonth}
                      </p>
                    ) : (
                      <p className="text-xs text-yellow-400 flex items-center gap-1">
                        <Clock size={12} />
                        Target not reached within 5-year forecast
                      </p>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
