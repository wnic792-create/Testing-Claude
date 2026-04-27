import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Banknote,
  AlertCircle, Percent, Calendar, ArrowRight, RefreshCw,
} from 'lucide-react'
import { api } from '../../api/client'
import type { Account, Transaction, Category } from '../../api/types'
import { useProfileStore } from '../../stores/profile'

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

type Period = 'this_month' | 'last_month' | 'last_3_months' | 'ytd' | 'last_12_months' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  ytd: 'Year to date',
  last_12_months: 'Last 12 months',
  all: 'All time',
}

function periodRange(period: Period, now: Date): { start: string; end: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const lastDay = (yr: number, mo: number) => new Date(yr, mo + 1, 0)
  switch (period) {
    case 'this_month':
      return { start: iso(new Date(y, m, 1)), end: iso(lastDay(y, m)) }
    case 'last_month':
      return { start: iso(new Date(y, m - 1, 1)), end: iso(lastDay(y, m - 1)) }
    case 'last_3_months':
      return { start: iso(new Date(y, m - 2, 1)), end: iso(lastDay(y, m)) }
    case 'ytd':
      return { start: iso(new Date(y, 0, 1)), end: iso(now) }
    case 'last_12_months':
      return { start: iso(new Date(y, m - 11, 1)), end: iso(lastDay(y, m)) }
    case 'all':
      return { start: '0000-01-01', end: '9999-12-31' }
  }
}


export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [period, setPeriod] = useState<Period>('this_month')
  const [acctFilter, setAcctFilter] = useState<'all' | 'liquid' | 'investments' | 'debts'>('all')
  const activeProfileId = useProfileStore(s => s.activeProfileId)
  // Tracks whether we've already auto-nudged the period once — so manual
  // selection isn't overridden by a later re-fetch.
  const [autoPicked, setAutoPicked] = useState(false)

  const refresh = useCallback(() => {
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
  }, [activeProfileId])

  useEffect(() => {
    refresh()
    // Re-fetch whenever the tab becomes visible again so imports/edits made
    // in another tab (or while idle) are picked up.
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

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

  // --- Period-aware helpers ----------------------------------------------
  const now = new Date()
  const { start: periodStart, end: periodEnd } = useMemo(
    () => periodRange(period, now),
    // `now` is rebuilt every render but the ISO slice only cares about the day
    // — tie the memo to the period and today's ISO date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, now.toDateString()],
  )
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Transfer-category IDs (Investment, Credit Card Payment, etc.)
  const transferCatIds = useMemo(
    () => new Set(categories.filter(c => c.is_transfer_category).map(c => c.id)),
    [categories],
  )

  // For charts + recent list: exclude is_transfer and split rows (clean expense view)
  const eligible = useMemo(
    () => transactions.filter(tx => !tx.is_transfer && !tx.is_split),
    [transactions],
  )

  // For KPI calculations: include transfer-category outflow legs so investment
  // contributions count toward cash flow / savings rate, but skip inflow legs
  // (positive is_transfer=true) to avoid double-counting the destination account.
  const kpiEligible = useMemo(
    () => transactions.filter(tx => !tx.is_split && !(tx.is_transfer && tx.amount > 0)),
    [transactions],
  )

  // One-shot: if initial load lands on an empty "this month", jump the user
  // to the most recent period that actually has data so the dashboard isn't
  // confusingly blank.
  useEffect(() => {
    if (autoPicked) return
    if (transactions.length === 0) return
    if (period !== 'this_month') return
    const hasThis = kpiEligible.some(tx => tx.date.startsWith(currentYm))
    if (hasThis) {
      setAutoPicked(true)
      return
    }
    // Find the latest month with any activity
    const months = new Set(kpiEligible.map(tx => tx.date.slice(0, 7)))
    if (months.size === 0) return
    const latest = [...months].sort().reverse()[0]
    const prevYmStr = prevYm
    if (latest === prevYmStr) setPeriod('last_month')
    else setPeriod('last_12_months')
    setAutoPicked(true)
  }, [transactions, kpiEligible, currentYm, prevYm, period, autoPicked])

  // Period totals — split into true expenses vs. transfer-category savings
  // (Investment contributions, CC payments treated as savings, not spending)
  const { incomeThis, expenseThis, transferSavedThis } = useMemo(() => {
    let income = 0, expense = 0, transferSaved = 0
    for (const tx of kpiEligible) {
      if (tx.date < periodStart || tx.date > periodEnd) continue
      if (tx.amount >= 0) {
        income += tx.amount
      } else {
        const isTransCat = tx.category_id ? transferCatIds.has(tx.category_id) : false
        if (isTransCat) transferSaved += Math.abs(tx.amount)
        else expense += Math.abs(tx.amount)
      }
    }
    return { incomeThis: income, expenseThis: expense, transferSavedThis: transferSaved }
  }, [kpiEligible, periodStart, periodEnd, transferCatIds])

  // Previous-month totals for savings-rate comparison (same split logic)
  const { incomePrev, expensePrev } = useMemo(() => {
    let income = 0, expense = 0
    for (const tx of kpiEligible) {
      if (!tx.date.startsWith(prevYm)) continue
      if (tx.amount >= 0) income += tx.amount
      else {
        const isTransCat = tx.category_id ? transferCatIds.has(tx.category_id) : false
        if (!isTransCat) expense += Math.abs(tx.amount)
      }
    }
    return { incomePrev: income, expensePrev: expense }
  }, [kpiEligible, prevYm, transferCatIds])

  // "This Month Net" = liquid cash retained (income − expenses − amount moved to investments/CC)
  const netThis = incomeThis - expenseThis - transferSavedThis
  // Savings rate treats transfer destinations as savings too: savings = income − true expenses
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

  // Per-account 12-month balance history (reconstructed backwards from current balance)
  const accountBalanceSeries = useMemo(() => {
    if (!accounts.length || !transactions.length) return []
    // monthEnds[0] = last day of current month, [12] = last day 12 months ago
    const monthEnds: Date[] = []
    for (let i = 0; i <= 12; i++) {
      monthEnds.push(new Date(now.getFullYear(), now.getMonth() - i + 1, 0))
    }
    const seriesByAccount: Record<number, number[]> = {}
    for (const acct of accounts) {
      const acctTxs = transactions.filter(tx => tx.account_id === acct.id && !tx.is_split)
      let running = acct.current_balance
      const balances: number[] = []
      for (let i = 0; i < monthEnds.length; i++) {
        balances.push(running)
        if (i < monthEnds.length - 1) {
          const endIso = monthEnds[i].toISOString().slice(0, 10)
          const prevIso = monthEnds[i + 1].toISOString().slice(0, 10)
          for (const tx of acctTxs) {
            if (tx.date > prevIso && tx.date <= endIso) running -= tx.amount
          }
        }
      }
      seriesByAccount[acct.id] = balances.reverse() // oldest → newest
    }
    return monthEnds.slice().reverse().map((d, idx) => {
      const point: Record<string, string | number> = {
        date: d.toLocaleDateString(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', year: '2-digit' }),
      }
      for (const acct of accounts) point[`a_${acct.id}`] = Math.round(seriesByAccount[acct.id]?.[idx] ?? 0)
      return point
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions, now.toDateString(), i18n.language])

  // Accounts visible in the chart based on type filter
  const filteredAccounts = useMemo(() => {
    switch (acctFilter) {
      case 'liquid':      return accounts.filter(a => LIQUID_TYPES.has(a.type))
      case 'investments': return accounts.filter(a => ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'crypto'].includes(a.type))
      case 'debts':       return accounts.filter(a => !a.is_asset)
      default:            return accounts
    }
  }, [accounts, acctFilter])

  // Month-over-month balance changes per account
  const acctChanges = useMemo(() => {
    const len = accountBalanceSeries.length
    if (len < 2) return []
    const latest   = accountBalanceSeries[len - 1]
    const prev1    = accountBalanceSeries[len - 2] ?? {}
    const prev3    = accountBalanceSeries[Math.max(len - 4, 0)] ?? {}
    const oldest   = accountBalanceSeries[0] ?? {}
    return accounts.map(acct => {
      const k       = `a_${acct.id}`
      const current = Number(latest[k] ?? 0)
      return {
        acct,
        current,
        mom:  current - Number(prev1[k] ?? 0),
        qtr:  current - Number(prev3[k] ?? 0),
        yoy:  current - Number(oldest[k] ?? 0),
      }
    }).sort((a, b) => Math.abs(b.yoy) - Math.abs(a.yoy))
  }, [accounts, accountBalanceSeries])

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

  // 12-month summary KPIs — must be after cashFlow12
  const annualKPIs = useMemo(() => {
    const len = accountBalanceSeries.length
    if (len < 2) return null
    const oldest = accountBalanceSeries[0]
    const latest = accountBalanceSeries[len - 1]
    const debtPaidOff = accounts
      .filter(a => !a.is_asset)
      .reduce((sum, a) => sum + (Number(latest[`a_${a.id}`] ?? 0) - Number(oldest[`a_${a.id}`] ?? 0)), 0)
    const investGrowth = accounts
      .filter(a => a.is_asset && ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'crypto'].includes(a.type))
      .reduce((sum, a) => sum + (Number(latest[`a_${a.id}`] ?? 0) - Number(oldest[`a_${a.id}`] ?? 0)), 0)
    const activeMonths = cashFlow12.filter(m => m.income > 0).length
    const avgMonthlySavings = activeMonths > 0
      ? cashFlow12.reduce((s, m) => s + Math.max(0, m.net), 0) / activeMonths
      : 0
    return { debtPaidOff, investGrowth, avgMonthlySavings }
  }, [accounts, accountBalanceSeries, cashFlow12])

  // Spending by category — selected period
  const spendByCategory = useMemo(() => {
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
    const parentMap: Record<number, string> = {}
    for (const c of categories) {
      if (!c.parent_id) parentMap[c.id] = i18n.language === 'fr' && c.name_fr ? c.name_fr : c.name
    }
    const buckets: Record<string, number> = {}
    for (const tx of eligible) {
      if (tx.date < periodStart || tx.date > periodEnd) continue
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
  }, [eligible, categories, periodStart, periodEnd, i18n.language])

  const totalSpendThis = spendByCategory.reduce((s, c) => s + c.value, 0)

  // Net worth series — prefer real snapshots; otherwise reconstruct a 12-month
  // trend by walking transactions backward from today's balance. This won't
  // capture market-value changes on investments/real-estate, but for checking
  // / savings / cards it's an honest picture of how net worth moved.
  const netWorthSeries = useMemo(() => {
    if (snapshots.length >= 2) {
      return snapshots.map(s => ({ date: s.date, netWorth: s.net_worth, source: 'snapshot' as const }))
    }
    if (accounts.length === 0 || transactions.length === 0) return []
    // Build month-end dates for the last 12 months (oldest first)
    const points: { date: string; netWorth: number; source: 'derived' }[] = []
    // Start with today's net worth and roll backwards, subtracting each
    // month's signed transactions (for eligible / non-split, non-transfer txs).
    // Liabilities are stored negative so tx.amount signs already compose.
    const monthEnds: Date[] = []
    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0) // last day of (month - i)
      monthEnds.push(d)
    }
    // Include every non-split, non-transfer tx against an account we still have
    const accountIds = new Set(accounts.map(a => a.id))
    const relevant = transactions.filter(
      tx => !tx.is_split && accountIds.has(tx.account_id),
    )
    let running = netWorth
    // monthEnds[0] is the end of the current month — use today's net worth
    for (let i = 0; i < monthEnds.length; i++) {
      const endIso = monthEnds[i].toISOString().slice(0, 10)
      if (i === 0) {
        points.push({ date: endIso, netWorth: running, source: 'derived' })
        continue
      }
      // Subtract all transactions that happened AFTER this month end but
      // BEFORE the previous month end we already snapshotted.
      const prevEndIso = monthEnds[i - 1].toISOString().slice(0, 10)
      for (const tx of relevant) {
        if (tx.date > endIso && tx.date <= prevEndIso) {
          // These moved the balance between endIso and prevEndIso; to step
          // back in time we undo their effect.
          running -= tx.amount
        }
      }
      points.push({ date: endIso, netWorth: running, source: 'derived' })
    }
    return points.reverse()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, accounts, transactions, netWorth, now.toDateString()])

  const isDerived = netWorthSeries.length > 0 && netWorthSeries[0].source === 'derived'

  // 30-day net-worth delta: prefer snapshot series, fall back to derived endpoints
  const netWorthDelta = useMemo(() => {
    if (netWorthSeries.length < 2) return null
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const iso = cutoff.toISOString().slice(0, 10)
    const older = [...netWorthSeries].reverse().find(s => s.date <= iso)
    if (!older) return null
    return netWorth - older.netWorth
  }, [netWorthSeries, netWorth])

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
    <div className="p-6 space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('dashboard.title')}</h1>
          <p className="text-xs text-surface-500 mt-0.5">
            {now.toLocaleDateString(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
            {' · '}{daysRemaining} days left in month
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={e => { setAutoPicked(true); setPeriod(e.target.value as Period) }}
            className="input text-xs py-1"
            title="Period used for income / spending / savings cards"
          >
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
          <button onClick={refresh} className="text-surface-500 hover:text-blue-400" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Section 1: Overview ────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionLabel>Overview</SectionLabel>

        {/* Alert for uncategorized transactions */}
        {uncategorizedCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-800/50 bg-amber-900/20 text-amber-300 text-sm">
            <AlertCircle size={15} />
            <span>
              {uncategorizedCount} transaction{uncategorizedCount === 1 ? '' : 's'} uncategorized — spending breakdown may be incomplete.
            </span>
            <a href="/transactions" className="ml-auto text-xs underline hover:no-underline shrink-0">Review</a>
          </div>
        )}

        {/* Hero KPI row */}
        <div className="grid grid-cols-4 gap-4">

          {/* Net Worth — hero card spanning 2 cols */}
          <div className="card col-span-2 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-surface-400 uppercase tracking-widest">Net Worth</p>
                <p className="text-4xl font-bold font-mono mt-2 tracking-tight">{fmt(netWorth)}</p>
                <div className="mt-1.5 text-xs">
                  {netWorthDelta != null ? (
                    <span className={`flex items-center gap-1 ${netWorthDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {netWorthDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {netWorthDelta >= 0 ? '+' : ''}{fmt(netWorthDelta)} over the last 30 days
                    </span>
                  ) : (
                    <span className="text-surface-500">Take a snapshot to track changes over time</span>
                  )}
                </div>
              </div>
              <Wallet size={18} className="text-surface-500 mt-1" />
            </div>

            {/* Breakdown strip */}
            <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-surface-700/60">
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-wide">Assets</p>
                <p className="text-sm font-mono font-semibold text-green-400 mt-0.5">{fmt(totalAssets)}</p>
              </div>
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-wide">Liabilities</p>
                <p className="text-sm font-mono font-semibold text-red-400 mt-0.5">{fmt(totalLiabilities)}</p>
              </div>
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-wide">Investments</p>
                <p className="text-sm font-mono font-semibold text-blue-400 mt-0.5">{fmt(investments)}</p>
              </div>
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-wide">Real Estate</p>
                <p className="text-sm font-mono font-semibold text-purple-400 mt-0.5">{fmt(realEstate)}</p>
              </div>
            </div>
          </div>

          {/* Liquid Cash */}
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-400 uppercase tracking-widest">Liquid Cash</p>
                <Banknote size={15} className="text-surface-500" />
              </div>
              <p className="text-2xl font-bold font-mono mt-2 text-green-400">{fmt(liquidCash)}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-surface-700/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-surface-500">Emergency runway</span>
                <span className={`font-semibold ${runwayMonths >= 3 ? 'text-green-400' : runwayMonths >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                  {runwayMonths > 0 ? `${runwayMonths.toFixed(1)} mo` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Monthly burn (3mo avg)</span>
                <span className="font-mono text-surface-300">{expense3moAvg > 0 ? fmt(expense3moAvg) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Period Summary */}
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-400 uppercase tracking-widest">
                  {PERIOD_LABELS[period]}
                </p>
                <Calendar size={15} className="text-surface-500" />
              </div>
              <p className={`text-2xl font-bold font-mono mt-2 ${netThis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netThis >= 0 ? '+' : ''}{fmt(netThis)}
              </p>
              <p className="text-[10px] text-surface-500 mt-0.5">Net cash retained</p>
            </div>
            <div className="mt-4 pt-4 border-t border-surface-700/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-surface-500">Income</span>
                <span className="font-mono text-green-400">{fmt(incomeThis)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Expenses</span>
                <span className="font-mono text-red-400">{fmt(expenseThis)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Savings rate</span>
                <span className={`font-semibold ${savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                  {incomeThis > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
                </span>
              </div>
              {transferSavedThis > 0 && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Invested / saved</span>
                  <span className="font-mono text-blue-400">{fmt(transferSavedThis)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Cash Flow ───────────────────────────────────── */}
      <section className="space-y-4">
        <SectionLabel>Cash Flow</SectionLabel>
        <div className="grid grid-cols-3 gap-4">

          {/* Cash flow bar chart */}
          <div className="card col-span-2 flex flex-col" style={{ minHeight: 320 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-surface-200">Last 12 months</p>
              <div className="flex items-center gap-3 text-xs text-surface-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500/80"/>Income</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500/80"/>Expenses</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-400"/>Net</span>
              </div>
            </div>
            {eligible.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cashFlow12} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => fmtCompact(v)} width={72} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(v: number) => fmt(v)}
                  />
                  <Bar dataKey="income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart hint="Import transactions to see your cash flow." />
            )}
          </div>

          {/* Spending by category — pie + list stacked */}
          <div className="card flex flex-col" style={{ minHeight: 320 }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-surface-200">Spending</p>
              <span className="text-xs text-surface-400">{PERIOD_LABELS[period].toLowerCase()}</span>
            </div>
            {spendByCategory.length > 0 ? (
              <>
                <p className="text-xl font-bold font-mono text-surface-100 mb-1">{fmt(totalSpendThis)}</p>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={spendByCategory} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={1}>
                      {spendByCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#0f172a" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5 flex-1 overflow-y-auto">
                  {spendByCategory.slice(0, 6).map((c, i) => {
                    const pct = totalSpendThis > 0 ? (c.value / totalSpendThis) * 100 : 0
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="truncate text-surface-300">{c.name}</span>
                          </span>
                          <span className="font-mono text-surface-400 shrink-0 ml-2 text-[11px]">{fmt(c.value)}</span>
                        </div>
                        <div className="h-1 mt-0.5 bg-surface-800 rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <EmptyChart hint={`No expenses in ${PERIOD_LABELS[period].toLowerCase()}.`} />
            )}
          </div>
        </div>
      </section>

      {/* ── Section 3: Trends & Activity ──────────────────────────── */}
      <section className="space-y-4">
        <SectionLabel>Trends &amp; Activity</SectionLabel>
        <div className="grid grid-cols-3 gap-4">

          {/* Net worth trend */}
          <div className="card col-span-2 flex flex-col" style={{ minHeight: 280 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-surface-200">Net Worth Trend</p>
              {isDerived && (
                <span className="text-[10px] text-surface-500 italic">estimated — take snapshots for accuracy</span>
              )}
            </div>
            {netWorthSeries.length >= 2 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={netWorthSeries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(0, 7)} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => fmtCompact(v)} width={72} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), 'Net Worth']}
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke={isDerived ? '#6366f1' : '#3b82f6'}
                    strokeWidth={2.5}
                    strokeDasharray={isDerived ? '4 2' : undefined}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
                <p className="text-surface-500 text-sm">Add transactions to see a trend, or take a manual snapshot.</p>
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

          {/* Recent activity */}
          <div className="card flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-surface-200">Recent Activity</p>
              <a href="/transactions" className="text-xs text-blue-400 hover:underline">View all</a>
            </div>
            {recent.length > 0 ? (
              <div className="divide-y divide-surface-800/70 flex-1">
                {recent.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-surface-200 font-medium" title={tx.description}>{tx.description}</p>
                      <p className="text-surface-500 text-[10px] mt-0.5">
                        {shortDate(tx.date)} · {accountName(tx.account_id)}
                      </p>
                      {tx.category_id && (
                        <p className="text-surface-600 text-[10px]">{catName(tx.category_id)}</p>
                      )}
                    </div>
                    <span className={`font-mono shrink-0 ml-3 text-[11px] font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
      </section>

      {/* ── Section 4: Account Balance History ────────────────────── */}
      {accountBalanceSeries.length >= 2 && (
        <section className="space-y-4">
          <SectionLabel>Account Balance History · 12 months</SectionLabel>

          <div className="card p-5">
            {/* Controls row */}
            <div className="flex items-center justify-between mb-4">
              {/* Filter tabs */}
              <div className="flex gap-1 bg-surface-800 rounded-lg p-1">
                {(['all', 'liquid', 'investments', 'debts'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setAcctFilter(f)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                      acctFilter === f
                        ? 'bg-surface-600 text-white shadow-sm'
                        : 'text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* 12-month summary pills */}
              {annualKPIs && (
                <div className="flex gap-2 flex-wrap">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${annualKPIs.debtPaidOff >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    <TrendingDown size={11} />
                    <span className="text-surface-400">Debt:</span>
                    {annualKPIs.debtPaidOff >= 0 ? `−${fmt(annualKPIs.debtPaidOff)}` : `+${fmt(Math.abs(annualKPIs.debtPaidOff))}`}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${annualKPIs.investGrowth >= 0 ? 'bg-blue-900/30 text-blue-400' : 'bg-red-900/30 text-red-400'}`}>
                    <TrendingUp size={11} />
                    <span className="text-surface-400">Investments:</span>
                    {annualKPIs.investGrowth >= 0 ? '+' : ''}{fmt(annualKPIs.investGrowth)}
                  </div>
                  {annualKPIs.avgMonthlySavings > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-700/50 text-xs text-surface-300 font-medium">
                      <Percent size={11} />
                      <span className="text-surface-400">Avg surplus/mo:</span>
                      {fmt(annualKPIs.avgMonthlySavings)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Line chart */}
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={accountBalanceSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => fmtCompact(v)} width={72} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                  formatter={(v: number, name: string) => [fmt(v), name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {filteredAccounts.map((a, i) => (
                  <Line
                    key={a.id}
                    type="monotone"
                    dataKey={`a_${a.id}`}
                    name={a.name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray={!a.is_asset ? '4 2' : undefined}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Month-over-month change table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-surface-500 border-b border-surface-700">
                    <th className="pb-2.5 font-medium">Account</th>
                    <th className="pb-2.5 font-medium text-right">Current Balance</th>
                    <th className="pb-2.5 font-medium text-right">vs Last Month</th>
                    <th className="pb-2.5 font-medium text-right">vs 3 Months Ago</th>
                    <th className="pb-2.5 font-medium text-right">12-Month Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/60">
                  {acctChanges.filter(r =>
                    acctFilter === 'all' ? true :
                    acctFilter === 'liquid' ? LIQUID_TYPES.has(r.acct.type) :
                    acctFilter === 'investments' ? ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'crypto'].includes(r.acct.type) :
                    !r.acct.is_asset
                  ).map(({ acct, current, mom, qtr, yoy }) => (
                    <tr key={acct.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="py-2.5">
                        <p className="font-medium text-surface-200">{acct.name}</p>
                        <p className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">{acct.type.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-surface-100">{fmt(current)}</td>
                      <td className={`py-2.5 text-right font-mono ${mom === 0 ? 'text-surface-500' : mom > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {mom === 0 ? '—' : `${mom > 0 ? '+' : ''}${fmt(mom)}`}
                      </td>
                      <td className={`py-2.5 text-right font-mono ${qtr === 0 ? 'text-surface-500' : qtr > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {qtr === 0 ? '—' : `${qtr > 0 ? '+' : ''}${fmt(qtr)}`}
                      </td>
                      <td className={`py-2.5 text-right font-mono font-semibold ${yoy === 0 ? 'text-surface-500' : yoy > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {yoy === 0 ? '—' : `${yoy > 0 ? '+' : ''}${fmt(yoy)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Section 5: Accounts ────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionLabel action={<a href="/accounts" className="text-xs text-blue-400 hover:underline">Manage</a>}>
          Accounts
        </SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {accounts.map(a => (
            <div key={a.id} className="card p-4 flex items-center justify-between hover:bg-surface-700/40 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="truncate text-surface-200 font-medium text-sm">{a.name}</p>
                <p className="text-surface-500 text-[11px] uppercase tracking-wide mt-0.5">{a.type.replace(/_/g, ' ')}</p>
              </div>
              <span className={`font-mono font-semibold shrink-0 ml-3 text-sm ${a.current_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(a.current_balance)}
              </span>
            </div>
          ))}
        </div>
      </section>
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

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-surface-400 whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-surface-700/50" />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
