import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Banknote, PiggyBank,
  AlertCircle, Percent, Calendar, ArrowRight,
} from 'lucide-react'
import { api } from '../../api/client'
import type { Account, Transaction, Category } from '../../api/types'

interface Snapshot {
  id: number
  date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
}

const LIQUID_TYPES = new Set(['chequing', 'savings_hisa'])
const COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#d946ef',
]

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts)
    api.get<Category[]>('/categories/flat').then(setCategories)
    api.get<Snapshot[]>('/accounts/snapshots').then(setSnapshots).catch(() => setSnapshots([]))

    // Pull last 13 months of transactions so the 12-month chart has room
    const since = new Date()
    since.setMonth(since.getMonth() - 13)
    const params = new URLSearchParams({
      date_from: since.toISOString().slice(0, 10),
      limit: '1000',
    })
    api.get<Transaction[]>(`/transactions?${params}`).then(setTransactions)
  }, [])

  const fmt = (n: number, digits = 0) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', maximumFractionDigits: digits,
    }).format(n)

  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1000) return fmt(n, 0)
    return fmt(n, 0)
  }

  // --- Account aggregates ------------------------------------------------
  const totalAssets = accounts.filter(a => a.is_asset).reduce((s, a) => s + a.current_balance, 0)
  const totalLiabilities = accounts.filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(a.current_balance), 0)
  const netWorth = totalAssets - totalLiabilities
  const liquidCash = accounts
    .filter(a => a.is_asset && LIQUID_TYPES.has(a.type))
    .reduce((s, a) => s + a.current_balance, 0)
  const investments = accounts
    .filter(a => a.is_asset && ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'crypto'].includes(a.type))
    .reduce((s, a) => s + a.current_balance, 0)
  const realEstate = accounts
    .filter(a => a.is_asset && a.type === 'real_estate')
    .reduce((s, a) => s + a.current_balance, 0)

  // --- Month-aware helpers -----------------------------------------------
  const now = new Date()
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  const eligible = useMemo(
    () => transactions.filter(tx => !tx.is_transfer && !tx.is_split),
    [transactions],
  )

  // Current-month totals
  const { incomeThis, expenseThis } = useMemo(() => {
    let income = 0, expense = 0
    for (const tx of eligible) {
      if (!tx.date.startsWith(currentYm)) continue
      if (tx.amount >= 0) income += tx.amount
      else expense += Math.abs(tx.amount)
    }
    return { incomeThis: income, expenseThis: expense }
  }, [eligible, currentYm])

  // Previous-month totals (for deltas)
  const { incomePrev, expensePrev } = useMemo(() => {
    let income = 0, expense = 0
    for (const tx of eligible) {
      if (!tx.date.startsWith(prevYm)) continue
      if (tx.amount >= 0) income += tx.amount
      else expense += Math.abs(tx.amount)
    }
    return { incomePrev: income, expensePrev: expense }
  }, [eligible, prevYm])

  const netThis = incomeThis - expenseThis
  const savingsRate = incomeThis > 0 ? ((incomeThis - expenseThis) / incomeThis) * 100 : 0

  // 3-month expense average for runway
  const expense3moAvg = useMemo(() => {
    const months: Record<string, number> = {}
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[ym] = 0
    }
    for (const tx of eligible) {
      const ym = tx.date.slice(0, 7)
      if (!(ym in months)) continue
      if (tx.amount < 0) months[ym] += Math.abs(tx.amount)
    }
    const vals = Object.values(months).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }, [eligible])

  const runwayMonths = expense3moAvg > 0 ? liquidCash / expense3moAvg : 0

  // 12-month cash flow series
  const cashFlow12 = useMemo(() => {
    const buckets: Record<string, { month: string; ym: string; income: number; expenses: number; net: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' })
      buckets[ym] = { month: label, ym, income: 0, expenses: 0, net: 0 }
    }
    for (const tx of eligible) {
      const ym = tx.date.slice(0, 7)
      if (!buckets[ym]) continue
      if (tx.amount >= 0) buckets[ym].income += tx.amount
      else buckets[ym].expenses += Math.abs(tx.amount)
    }
    for (const b of Object.values(buckets)) b.net = b.income - b.expenses
    return Object.values(buckets)
  }, [eligible, i18n.language])

  // Spending by category — current month
  const spendByCategory = useMemo(() => {
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
    const parentMap: Record<number, string> = {}
    for (const c of categories) {
      if (!c.parent_id) parentMap[c.id] = i18n.language === 'fr' && c.name_fr ? c.name_fr : c.name
    }
    const buckets: Record<string, number> = {}
    for (const tx of eligible) {
      if (!tx.date.startsWith(currentYm)) continue
      if (tx.amount >= 0) continue
      const cat = tx.category_id ? catMap[tx.category_id] : null
      let label: string
      if (!cat) label = i18n.language === 'fr' ? 'Non catégorisé' : 'Uncategorized'
      else if (cat.parent_id && parentMap[cat.parent_id]) label = parentMap[cat.parent_id]
      else label = i18n.language === 'fr' && cat.name_fr ? cat.name_fr : cat.name
      buckets[label] = (buckets[label] || 0) + Math.abs(tx.amount)
    }
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [eligible, categories, currentYm, i18n.language])

  const totalSpendThis = spendByCategory.reduce((s, c) => s + c.value, 0)

  // Net worth series
  const netWorthSeries = useMemo(
    () => snapshots.map(s => ({ date: s.date, netWorth: s.net_worth })),
    [snapshots],
  )
  const snapshot30Ago = useMemo(() => {
    if (snapshots.length < 2) return null
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const iso = cutoff.toISOString().slice(0, 10)
    const older = [...snapshots].reverse().find(s => s.date <= iso)
    return older ?? snapshots[0]
  }, [snapshots])
  const netWorthDelta = snapshot30Ago ? netWorth - snapshot30Ago.net_worth : null

  // Recent transactions
  const recent = useMemo(
    () => [...eligible].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    [eligible],
  )

  // Uncategorized count
  const uncategorizedCount = transactions.filter(tx => !tx.category_id && !tx.is_transfer).length

  // Days remaining in month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - now.getDate()

  // Helpers
  const accountName = (id: number) => accounts.find(a => a.id === id)?.name || '—'
  const catName = (id: number | null) => {
    if (!id) return '—'
    const c = categories.find(x => x.id === id)
    if (!c) return '—'
    return i18n.language === 'fr' && c.name_fr ? c.name_fr : c.name
  }
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      month: 'short', day: 'numeric',
    })

  const noData = accounts.length === 0 && transactions.length === 0

  if (noData) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-6">{t('dashboard.title')}</h1>
        <div className="card p-12 text-center">
          <Wallet className="mx-auto text-surface-600 mb-4" size={48} />
          <p className="text-surface-300 font-medium mb-2">Welcome to Local Finance</p>
          <p className="text-surface-500 text-sm mb-6">
            Start by adding accounts and importing transactions to see your financial picture.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="/accounts" className="btn-primary flex items-center gap-2">
              Add accounts <ArrowRight size={14} />
            </a>
            <a href="/transactions" className="btn-secondary">Import transactions</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{t('dashboard.title')}</h1>
        <p className="text-xs text-surface-500">
          {now.toLocaleDateString(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
          {' · '}
          {daysRemaining} days left in month
        </p>
      </div>

      {/* ── Primary KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Net Worth</p>
            <Wallet size={14} className="text-surface-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-1">{fmt(netWorth)}</p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            {netWorthDelta != null ? (
              <span className={`flex items-center gap-0.5 ${netWorthDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netWorthDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {netWorthDelta >= 0 ? '+' : ''}{fmt(netWorthDelta)} (30d)
              </span>
            ) : (
              <span className="text-surface-500">Take snapshots to track change</span>
            )}
          </div>
        </div>

        {/* Liquid Cash */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Liquid Cash</p>
            <Banknote size={14} className="text-surface-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-1 text-green-400">{fmt(liquidCash)}</p>
          <p className="text-xs text-surface-500 mt-1">
            {runwayMonths > 0
              ? `${runwayMonths.toFixed(1)} months runway`
              : 'Chequing + savings accounts'}
          </p>
        </div>

        {/* This Month Net */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-400 uppercase tracking-wide">This Month</p>
            <Calendar size={14} className="text-surface-500" />
          </div>
          <p className={`text-2xl font-bold font-mono mt-1 ${netThis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netThis >= 0 ? '+' : ''}{fmt(netThis)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
            <span>in {fmt(incomeThis)}</span>
            <span>out {fmt(expenseThis)}</span>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Savings Rate</p>
            <Percent size={14} className="text-surface-500" />
          </div>
          <p className={`text-2xl font-bold font-mono mt-1 ${
            savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {incomeThis > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            Last month: {incomePrev > 0 ? `${(((incomePrev - expensePrev) / incomePrev) * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* ── Secondary info ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">Assets</p>
          <p className="text-sm font-mono text-green-400 mt-1">{fmt(totalAssets)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">Liabilities</p>
          <p className="text-sm font-mono text-red-400 mt-1">{fmt(totalLiabilities)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">Investments</p>
          <p className="text-sm font-mono mt-1">{fmt(investments)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">Real Estate</p>
          <p className="text-sm font-mono mt-1">{fmt(realEstate)}</p>
        </div>
      </div>

      {/* Alert for uncategorized transactions */}
      {uncategorizedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded border border-amber-900/50 bg-amber-900/20 text-amber-300 text-sm">
          <AlertCircle size={16} />
          <span>
            {uncategorizedCount} transaction{uncategorizedCount === 1 ? '' : 's'} uncategorized — your spending breakdown is incomplete.
          </span>
          <a href="/transactions" className="ml-auto text-xs underline hover:no-underline">Review</a>
        </div>
      )}

      {/* ── Charts row 1 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Cash flow 12 months */}
        <div className="card col-span-2 h-72 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Cash flow · last 12 months</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500"/>Income</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500"/>Expenses</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400"/>Net</span>
            </div>
          </div>
          {eligible.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow12} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={v => fmtCompact(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="income" fill="#22c55e" />
                <Bar dataKey="expenses" fill="#ef4444" />
                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart hint="Import transactions to see your cash flow." />
          )}
        </div>

        {/* Spending by category */}
        <div className="card h-72 flex flex-col">
          <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">
            Spending this month · {fmt(totalSpendThis)}
          </p>
          {spendByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spendByCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={1}
                >
                  {spendByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#0f172a" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart hint="No expenses this month yet." />
          )}
        </div>
      </div>

      {/* ── Row 2: Net Worth trend + Top categories + Recent txns ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Net worth trend */}
        <div className="card h-64 flex flex-col">
          <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">Net worth trend</p>
          {netWorthSeries.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netWorthSeries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={v => fmtCompact(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Line type="monotone" dataKey="netWorth" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <p className="text-surface-500 text-sm mb-3">
                {snapshots.length === 0
                  ? 'No snapshots yet.'
                  : 'Need at least 2 snapshots to chart.'}
              </p>
              <button
                onClick={async () => {
                  await api.post('/accounts/snapshots')
                  const s = await api.get<Snapshot[]>('/accounts/snapshots')
                  setSnapshots(s)
                }}
                className="btn-primary text-xs"
              >
                Take snapshot now
              </button>
            </div>
          )}
        </div>

        {/* Top spending categories */}
        <div className="card flex flex-col">
          <p className="text-xs text-surface-400 uppercase tracking-wide mb-3">Top spending · this month</p>
          {spendByCategory.length > 0 ? (
            <div className="space-y-2 flex-1">
              {spendByCategory.slice(0, 6).map((c, i) => {
                const pct = totalSpendThis > 0 ? (c.value / totalSpendThis) * 100 : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-mono text-surface-300 shrink-0 ml-2">{fmt(c.value)}</span>
                    </div>
                    <div className="h-1 mt-1 bg-surface-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">Nothing spent yet this month.</p>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-surface-400 uppercase tracking-wide">Recent activity</p>
            <a href="/transactions" className="text-xs text-blue-400 hover:underline">All</a>
          </div>
          {recent.length > 0 ? (
            <div className="divide-y divide-surface-800 -mx-1">
              {recent.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 px-1 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-surface-200" title={tx.description}>{tx.description}</p>
                    <p className="text-surface-500 text-[10px] mt-0.5">
                      {shortDate(tx.date)} · {accountName(tx.account_id)} · {catName(tx.category_id)}
                    </p>
                  </div>
                  <span className={`font-mono shrink-0 ml-2 ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">No transactions yet.</p>
          )}
        </div>
      </div>

      {/* ── Accounts breakdown ─────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-surface-400 uppercase tracking-wide">Accounts</p>
          <a href="/accounts" className="text-xs text-blue-400 hover:underline">Manage</a>
        </div>
        {accounts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-surface-800 rounded text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-surface-200">{a.name}</p>
                  <p className="text-surface-500 text-[10px]">{a.type}</p>
                </div>
                <span className={`font-mono shrink-0 ml-2 ${a.current_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(a.current_balance)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No accounts yet.</p>
        )}
      </div>
    </div>
  )
}

function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-surface-500 text-sm text-center px-4">
      {hint}
    </div>
  )
}
