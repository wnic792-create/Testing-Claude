import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import { api } from '../../api/client'
import type { Scenario, Account } from '../../api/types'
import { useProfileStore } from '../../stores/profile'

interface ForecastMonth {
  month: number
  date_label: string
  income: number
  expenses: number
  tax: number
  net_cash_flow: number
  savings_contributions: number
  debt_payments: number
  investment_growth: number
  assets: number
  liabilities: number
  net_worth: number
  balances: Record<string, number>
}

interface ForecastResult {
  scenario_id: number
  scenario_name: string
  scenario_color: string
  months: ForecastMonth[]
  summary: {
    starting_net_worth: number
    ending_net_worth: number
    net_worth_change: number
    total_income: number
    total_expenses: number
    total_tax: number
    total_savings: number
    total_investment_growth: number
    total_debt_payments: number
  }
}

type Granularity = 'monthly' | 'quarterly' | 'yearly'
type ChartView = 'net_worth' | 'cash_flow' | 'investment_growth' | 'assets_liabilities'
type HorizonYears = 5 | 10 | 15 | 20 | 30

const INVESTMENT_ACCOUNT_TYPES = ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'savings_hisa']

const ACCT_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a78bfa',
  '#f97316', '#ec4899', '#06b6d4', '#84cc16',
]

const chartDescription = (view: ChartView, years: number): string => {
  switch (view) {
    case 'net_worth': return `How your total net worth (assets minus debts) evolves over ${years} years.`
    case 'cash_flow': return 'Monthly income vs. expenses (includes debt payments & taxes). Green = income, Red = outflow.'
    case 'investment_growth': return `Balance of each investment & savings account over ${years} years. Stack height = total portfolio value.`
    case 'assets_liabilities': return 'Your total assets and total debts tracked separately over time.'
  }
}

export default function ForecastPage() {
  const { i18n } = useTranslation()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [forecasts, setForecasts] = useState<ForecastResult[]>([])
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const [chartView, setChartView] = useState<ChartView>('net_worth')
  const [horizonYears, setHorizonYears] = useState<HorizonYears>(5)
  const [loading, setLoading] = useState(false)
  const activeProfileId = useProfileStore(s => s.activeProfileId)

  useEffect(() => {
    api.get<Scenario[]>('/scenarios').then(s => {
      setScenarios(s)
      if (s.length > 0) setSelectedIds([s[0].id])
    })
    api.get<Account[]>('/accounts').then(setAccounts)
  }, [activeProfileId])

  useEffect(() => {
    if (selectedIds.length === 0) return
    setLoading(true)
    const ids = selectedIds.join(',')
    const months = horizonYears * 12
    api.get<ForecastResult[]>(`/forecast/compare?scenario_ids=${ids}&granularity=${granularity}&horizon_months=${months}`)
      .then(setForecasts)
      .finally(() => setLoading(false))
  }, [selectedIds, granularity, horizonYears])

  const toggleScenario = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 0,
    }).format(n)

  const fmtFull = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
    }).format(n)

  const primary = forecasts[0]

  // Investment accounts that have non-zero balances in the primary forecast
  const investAccounts = accounts.filter(a =>
    INVESTMENT_ACCOUNT_TYPES.includes(a.type) &&
    primary?.months.some(m => (m.balances?.[String(a.id)] ?? 0) > 0)
  )

  // Build chart data
  const cumulatives: Record<string, { savings: number; growth: number }> = {}
  const chartData = forecasts.length > 0
    ? forecasts[0].months.map((m, i) => {
        const point: Record<string, string | number> = { date: m.date_label }
        for (const f of forecasts) {
          const fm = f.months[i]
          if (!fm) continue
          const p = f.scenario_name
          if (!cumulatives[p]) cumulatives[p] = { savings: 0, growth: 0 }
          cumulatives[p].savings += fm.savings_contributions
          cumulatives[p].growth += fm.investment_growth
          point[`${p}_nw`] = fm.net_worth
          point[`${p}_assets`] = fm.assets
          point[`${p}_liab`] = fm.liabilities
          point[`${p}_income`] = fm.income
          point[`${p}_expenses`] = fm.expenses + fm.tax
          point[`${p}_cashflow`] = fm.net_cash_flow
          point[`${p}_cum_savings`] = Math.round(cumulatives[p].savings)
          point[`${p}_cum_growth`] = Math.round(cumulatives[p].growth)
        }
        // Per-account balances (always from primary scenario)
        const pfm = primary.months[i]
        if (pfm) {
          for (const acct of investAccounts) {
            point[`acct_${acct.id}`] = Math.max(0, pfm.balances?.[String(acct.id)] ?? 0)
          }
        }
        return point
      })
    : []

  // Build yearly rows
  const yearlyRows = (() => {
    if (!primary) return []
    const byYear: Record<string, {
      income: number; expenses: number; tax: number; net_worth: number
      savings: number; debt_payments: number; month_count: number
    }> = {}
    for (const m of primary.months) {
      const yr = m.date_label.slice(0, 4)
      if (!byYear[yr]) byYear[yr] = { income: 0, expenses: 0, tax: 0, net_worth: 0, savings: 0, debt_payments: 0, month_count: 0 }
      byYear[yr].income += m.income
      byYear[yr].expenses += m.expenses
      byYear[yr].tax += m.tax
      byYear[yr].net_worth = m.net_worth
      byYear[yr].savings += m.savings_contributions
      byYear[yr].debt_payments += m.debt_payments
      byYear[yr].month_count += 1
    }
    return Object.entries(byYear).map(([yr, v]) => ({ year: yr, ...v }))
  })()

  const yearlyTotals = yearlyRows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expenses: acc.expenses + r.expenses,
      tax: acc.tax + r.tax,
      savings: acc.savings + r.savings,
      debt_payments: acc.debt_payments + r.debt_payments,
    }),
    { income: 0, expenses: 0, tax: 0, savings: 0, debt_payments: 0 }
  )

  // Portfolio breakdown: starting vs ending balance per investment account
  const portfolioRows = investAccounts.map((acct, idx) => {
    const firstMonth = primary?.months[0]
    const lastMonth = primary?.months[primary.months.length - 1]
    const startBal = firstMonth?.balances?.[String(acct.id)] ?? 0
    const endBal = lastMonth?.balances?.[String(acct.id)] ?? 0
    return { acct, startBal, endBal, color: ACCT_COLORS[idx % ACCT_COLORS.length] }
  })
  const portfolioTotal = { start: portfolioRows.reduce((s, r) => s + r.startBal, 0), end: portfolioRows.reduce((s, r) => s + r.endBal, 0) }

  const tooltipStyle = { backgroundColor: '#222222', border: '1px solid #475569', borderRadius: 6, fontSize: 12 }
  const s = primary?.summary

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Forecast</h1>
          <p className="text-xs text-surface-500 mt-0.5">{horizonYears}-year projection based on your scenario assumptions</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Horizon selector */}
          <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1">
            {([5, 10, 15, 20, 30] as HorizonYears[]).map(y => (
              <button key={y} onClick={() => setHorizonYears(y)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  horizonYears === y ? 'bg-accent text-white' : 'text-surface-400 hover:text-surface-200'
                }`}>
                {y}y
              </button>
            ))}
          </div>
          {/* Granularity selector */}
          <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1">
            {(['monthly', 'quarterly', 'yearly'] as Granularity[]).map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  granularity === g ? 'bg-surface-600 text-white' : 'text-surface-400 hover:text-surface-200'
                }`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-surface-500">Scenarios:</span>
        {scenarios.map(sc => (
          <button key={sc.id} onClick={() => toggleScenario(sc.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border transition-colors ${
              selectedIds.includes(sc.id)
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-surface-600 text-surface-400 hover:border-surface-500'
            }`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
            {sc.name}
          </button>
        ))}
      </div>

      {scenarios.length === 0 ? (
        <div className="card text-center py-16">
          <TrendingUp size={32} className="mx-auto text-surface-600 mb-3" />
          <p className="text-surface-400 font-medium">No scenarios yet</p>
          <p className="text-surface-500 text-sm mt-1">Go to Scenarios to create your first financial projection.</p>
        </div>
      ) : loading ? (
        <div className="card text-center py-12">
          <p className="text-surface-500 animate-pulse">Running forecast…</p>
        </div>
      ) : primary && s ? (
        <>
          {/* Summary cards */}
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-3">{horizonYears}-Year Summary — {primary.scenario_name}</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="card col-span-2 lg:col-span-1">
                <p className="text-xs text-surface-400 uppercase mb-2">Net Worth</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-surface-500">Today</p>
                    <p className="text-base font-bold font-mono">{fmt(s.starting_net_worth)}</p>
                  </div>
                  <div className="text-center px-2">
                    {s.net_worth_change >= 0
                      ? <TrendingUp size={18} className="text-accent mx-auto" />
                      : <TrendingDown size={18} className="text-negative mx-auto" />}
                    <p className={`text-xs font-mono font-bold mt-0.5 ${s.net_worth_change >= 0 ? 'text-accent' : 'text-negative'}`}>
                      {s.net_worth_change >= 0 ? '+' : ''}{fmt(s.net_worth_change)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-surface-500">In {horizonYears} Years</p>
                    <p className="text-base font-bold font-mono">{fmt(s.ending_net_worth)}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="text-xs text-surface-400 uppercase mb-2">{horizonYears}-Year Income vs Outflows</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Gross Income</span>
                    <span className="font-mono text-accent">{fmtFull(s.total_income)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Taxes</span>
                    <span className="font-mono text-orange-400">−{fmtFull(s.total_tax)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Living Expenses</span>
                    <span className="font-mono text-negative">−{fmtFull(s.total_expenses - (s.total_debt_payments || 0))}</span>
                  </div>
                  {(s.total_debt_payments || 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-400">Debt Payments</span>
                      <span className="font-mono text-negative">−{fmtFull(s.total_debt_payments)}</span>
                    </div>
                  )}
                  <div className="border-t border-surface-700 pt-1 flex justify-between text-xs font-semibold">
                    <span className="text-surface-300">Net Cash Flow</span>
                    <span className={`font-mono ${(s.total_income - s.total_expenses - s.total_tax) >= 0 ? 'text-accent' : 'text-negative'}`}>
                      {fmtFull(s.total_income - s.total_expenses - s.total_tax)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="text-xs text-surface-400 uppercase mb-2">Savings & Investment</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Total Contributed</span>
                    <span className="font-mono text-accent">{fmtFull(s.total_savings)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Compound Growth</span>
                    <span className="font-mono text-accent">+{fmtFull(s.total_investment_growth)}</span>
                  </div>
                  <div className="border-t border-surface-700 pt-1 flex justify-between text-xs font-semibold">
                    <span className="text-surface-300">Total Portfolio Value</span>
                    <span className="font-mono text-surface-200">{fmtFull(s.total_savings + s.total_investment_growth)}</span>
                  </div>
                  {s.total_savings > 0 && (
                    <p className="text-[10px] text-surface-500">
                      {Math.round(s.total_investment_growth / s.total_savings * 100)}% return on contributions
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chart section */}
          <div className="card p-4">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex gap-1 flex-wrap">
                {([
                  ['net_worth', 'Net Worth'],
                  ['cash_flow', 'Cash Flow'],
                  ['investment_growth', 'Savings & Growth'],
                  ['assets_liabilities', 'Assets vs Debts'],
                ] as [ChartView, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setChartView(key)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      chartView === key
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-surface-500 flex items-center gap-1.5 mb-4">
              <Info size={11} />
              {chartDescription(chartView, horizonYears)}
            </p>

            <ResponsiveContainer width="100%" height={380}>
              {chartView === 'net_worth' ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtFull(v), '']} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                  {forecasts.map(f => (
                    <Area key={f.scenario_id} type="monotone" dataKey={`${f.scenario_name}_nw`}
                      name={f.scenario_name} stroke={f.scenario_color} fill={f.scenario_color}
                      fillOpacity={0.1} strokeWidth={2} dot={false} />
                  ))}
                </AreaChart>
              ) : chartView === 'cash_flow' ? (
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtFull(v), '']} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                  {forecasts.map(f => (
                    <Bar key={`${f.scenario_id}_inc`} dataKey={`${f.scenario_name}_income`}
                      name={`${f.scenario_name} Income`} fill="#22c55e" fillOpacity={0.8} />
                  ))}
                  {forecasts.map(f => (
                    <Bar key={`${f.scenario_id}_exp`} dataKey={`${f.scenario_name}_expenses`}
                      name={`${f.scenario_name} Expenses + Tax`} fill="#ef4444" fillOpacity={0.7} />
                  ))}
                </BarChart>
              ) : chartView === 'investment_growth' ? (
                investAccounts.length > 0 ? (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={70} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [fmtFull(v), name]}
                    />
                    <Legend />
                    {investAccounts.map((acct, idx) => (
                      <Area
                        key={acct.id}
                        type="monotone"
                        dataKey={`acct_${acct.id}`}
                        name={acct.name}
                        stroke={ACCT_COLORS[idx % ACCT_COLORS.length]}
                        fill={ACCT_COLORS[idx % ACCT_COLORS.length]}
                        fillOpacity={0.45}
                        strokeWidth={2}
                        stackId="portfolio"
                        dot={false}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={70} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtFull(v), '']} />
                    <Legend />
                    {forecasts.map(f => (
                      <Area key={`${f.scenario_id}_s`} type="monotone" dataKey={`${f.scenario_name}_cum_savings`}
                        name={`${f.scenario_name} Contributed`} stroke="#3b82f6" fill="#3b82f6"
                        fillOpacity={0.3} strokeWidth={2} stackId={`s_${f.scenario_id}`} dot={false} />
                    ))}
                    {forecasts.map(f => (
                      <Area key={`${f.scenario_id}_g`} type="monotone" dataKey={`${f.scenario_name}_cum_growth`}
                        name={`${f.scenario_name} Growth`} stroke="#22c55e" fill="#22c55e"
                        fillOpacity={0.4} strokeWidth={2} stackId={`s_${f.scenario_id}`} dot={false} />
                    ))}
                  </AreaChart>
                )
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtFull(v), '']} />
                  <Legend />
                  {forecasts.map(f => (
                    <Line key={`${f.scenario_id}_a`} type="monotone" dataKey={`${f.scenario_name}_assets`}
                      name={`${f.scenario_name} Assets`} stroke="#22c55e" strokeWidth={2} dot={false} />
                  ))}
                  {forecasts.map(f => (
                    <Line key={`${f.scenario_id}_l`} type="monotone" dataKey={`${f.scenario_name}_liab`}
                      name={`${f.scenario_name} Debts`} stroke="#ef4444" strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>

            {/* Per-account breakdown table — only shown for Savings & Growth */}
            {chartView === 'investment_growth' && portfolioRows.length > 0 && (
              <div className="mt-4 border-t border-surface-700 pt-4">
                <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">
                  Portfolio Breakdown — {primary.scenario_name}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-surface-500 border-b border-surface-700">
                      <th className="pb-2 font-medium">Account</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium text-right">Today</th>
                      <th className="pb-2 font-medium text-right">In {horizonYears} Years</th>
                      <th className="pb-2 font-medium text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {portfolioRows.map(({ acct, startBal, endBal, color }) => (
                      <tr key={acct.id} className="hover:bg-surface-800/40">
                        <td className="py-2 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-surface-200">{acct.name}</span>
                        </td>
                        <td className="py-2 text-surface-500 uppercase">{acct.type.replace('_', ' ')}</td>
                        <td className="py-2 text-right font-mono text-surface-300">{fmtFull(startBal)}</td>
                        <td className="py-2 text-right font-mono font-semibold text-surface-100">{fmtFull(endBal)}</td>
                        <td className={`py-2 text-right font-mono font-semibold ${endBal - startBal >= 0 ? 'text-accent' : 'text-negative'}`}>
                          {endBal - startBal >= 0 ? '+' : ''}{fmtFull(endBal - startBal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface-600 font-semibold">
                      <td className="py-2 text-surface-300" colSpan={2}>Total Portfolio</td>
                      <td className="py-2 text-right font-mono text-surface-300">{fmtFull(portfolioTotal.start)}</td>
                      <td className="py-2 text-right font-mono text-surface-100">{fmtFull(portfolioTotal.end)}</td>
                      <td className={`py-2 text-right font-mono ${portfolioTotal.end - portfolioTotal.start >= 0 ? 'text-accent' : 'text-negative'}`}>
                        {portfolioTotal.end - portfolioTotal.start >= 0 ? '+' : ''}{fmtFull(portfolioTotal.end - portfolioTotal.start)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Year-by-year breakdown table */}
          {yearlyRows.length > 0 && (
            <div className="card p-4">
              <p className="text-xs text-surface-400 uppercase tracking-wide mb-1">Year-by-Year Breakdown — {primary.scenario_name}</p>
              <p className="text-[10px] text-surface-500 mb-3">
                Expenses include rent, bills, food, etc. Debt payments (mortgage, loans, credit cards) shown separately. Tax = income tax + CPP/EI deductions.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-surface-500 border-b border-surface-700">
                      <th className="pb-2 font-medium">Year</th>
                      <th className="pb-2 font-medium text-right">Gross Income</th>
                      <th className="pb-2 font-medium text-right">Living Expenses</th>
                      <th className="pb-2 font-medium text-right">Debt Payments</th>
                      <th className="pb-2 font-medium text-right">Taxes</th>
                      <th className="pb-2 font-medium text-right">Saved</th>
                      <th className="pb-2 font-medium text-right">Net Worth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {yearlyRows.map(row => (
                      <tr key={row.year} className="hover:bg-surface-800/40">
                        <td className="py-2 font-medium text-surface-300">
                          {row.year}
                          {row.month_count < 12 && (
                            <span className="text-surface-500 font-normal ml-1">({row.month_count} mo)</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono text-accent">{fmtFull(row.income)}</td>
                        <td className="py-2 text-right font-mono text-negative">{fmtFull(row.expenses - row.debt_payments)}</td>
                        <td className="py-2 text-right font-mono text-negative">{fmtFull(row.debt_payments)}</td>
                        <td className="py-2 text-right font-mono text-orange-400">{fmtFull(row.tax)}</td>
                        <td className="py-2 text-right font-mono text-accent">{fmtFull(row.savings)}</td>
                        <td className="py-2 text-right font-mono font-semibold text-surface-100">{fmtFull(row.net_worth)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface-600 font-semibold">
                      <td className="py-2 text-surface-300">{horizonYears}-Year Total</td>
                      <td className="py-2 text-right font-mono text-accent">{fmtFull(yearlyTotals.income)}</td>
                      <td className="py-2 text-right font-mono text-negative">{fmtFull(yearlyTotals.expenses - yearlyTotals.debt_payments)}</td>
                      <td className="py-2 text-right font-mono text-negative">{fmtFull(yearlyTotals.debt_payments)}</td>
                      <td className="py-2 text-right font-mono text-orange-400">{fmtFull(yearlyTotals.tax)}</td>
                      <td className="py-2 text-right font-mono text-accent">{fmtFull(yearlyTotals.savings)}</td>
                      <td className="py-2 text-right font-mono text-surface-500">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
