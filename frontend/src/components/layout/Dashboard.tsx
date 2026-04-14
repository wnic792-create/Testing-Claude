import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { api } from '../../api/client'
import type { Account, Transaction } from '../../api/types'

interface Snapshot {
  id: number
  date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts)
    // Pull the last 12 months of transactions for dashboard aggregates
    const since = new Date()
    since.setMonth(since.getMonth() - 12)
    const params = new URLSearchParams({
      date_from: since.toISOString().slice(0, 10),
      limit: '1000',
    })
    api.get<Transaction[]>(`/transactions?${params}`).then(setTransactions)
    api.get<Snapshot[]>('/accounts/snapshots').then(setSnapshots).catch(() => setSnapshots([]))
  }, [])

  // --- Aggregate metrics -------------------------------------------------
  const totalAssets = accounts.filter(a => a.is_asset).reduce((s, a) => s + a.current_balance, 0)
  const totalLiabilities = accounts.filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(a.current_balance), 0)
  const netWorth = totalAssets - totalLiabilities

  const { monthlyIncome, monthlyExpenses, savingsRate } = useMemo(() => {
    const now = new Date()
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let income = 0
    let expenses = 0
    for (const tx of transactions) {
      if (tx.is_transfer) continue
      if (!tx.date.startsWith(currentYm)) continue
      if (tx.amount >= 0) income += tx.amount
      else expenses += Math.abs(tx.amount)
    }
    const rate = income > 0 ? ((income - expenses) / income) * 100 : 0
    return { monthlyIncome: income, monthlyExpenses: expenses, savingsRate: rate }
  }, [transactions])

  // Cash flow per month (last 6 months)
  const cashFlowData = useMemo(() => {
    const buckets: Record<string, { month: string; income: number; expenses: number }> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = { month: key.slice(2), income: 0, expenses: 0 }
    }
    for (const tx of transactions) {
      if (tx.is_transfer) continue
      const key = tx.date.slice(0, 7)
      if (!buckets[key]) continue
      if (tx.amount >= 0) buckets[key].income += tx.amount
      else buckets[key].expenses += Math.abs(tx.amount)
    }
    return Object.values(buckets)
  }, [transactions])

  const netWorthSeries = useMemo(() => {
    return snapshots.map(s => ({ date: s.date, netWorth: s.net_worth }))
  }, [snapshots])

  const fmt = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
    }).format(n)

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.netWorth')}</p>
          <p className="text-2xl font-bold mt-1 font-mono">{accounts.length ? fmt(netWorth) : '—'}</p>
          <p className="text-xs text-surface-500 mt-1">
            {fmt(totalAssets)} − {fmt(totalLiabilities)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.monthlyIncome')}</p>
          <p className="text-2xl font-bold mt-1 font-mono text-green-400">
            {transactions.length ? fmt(monthlyIncome) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.monthlyExpenses')}</p>
          <p className="text-2xl font-bold mt-1 font-mono text-red-400">
            {transactions.length ? fmt(monthlyExpenses) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.savingsRate')}</p>
          <p className="text-2xl font-bold mt-1 font-mono text-blue-400">
            {monthlyIncome > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card h-64">
          <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">{t('dashboard.netWorth')}</p>
          {netWorthSeries.length >= 2 ? (
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={netWorthSeries}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={fmt} width={80} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(v: number) => fmt(v)}
                />
                <Line type="monotone" dataKey="netWorth" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-surface-500 text-sm text-center px-4">
              {snapshots.length === 0
                ? 'Take a snapshot from the Accounts page to start tracking net worth.'
                : 'Need at least 2 snapshots to chart.'}
            </div>
          )}
        </div>
        <div className="card h-64">
          <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">Cash flow (last 6 months)</p>
          {transactions.length > 0 ? (
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={cashFlowData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={fmt} width={80} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="income" fill="#22c55e" />
                <Bar dataKey="expenses" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-surface-500 text-sm">
              {t('dashboard.cashFlowChart')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
