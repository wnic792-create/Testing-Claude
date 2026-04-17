import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { api } from '../../api/client'
import type { Scenario } from '../../api/types'

interface ForecastMonth {
  month: number
  date_label: string
  income: number
  expenses: number
  tax: number
  net_cash_flow: number
  savings_contributions: number
  investment_growth: number
  assets: number
  liabilities: number
  net_worth: number
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
  }
}

type Granularity = 'monthly' | 'quarterly' | 'yearly'
type ChartView = 'net_worth' | 'cash_flow' | 'investment_growth' | 'assets_liabilities'

const CHART_DESCRIPTIONS: Record<ChartView, string> = {
  net_worth: 'How your total net worth (assets minus debts) evolves over 5 years.',
  cash_flow: 'Monthly income vs. expenses. Green bars above zero = surplus; red below = shortfall.',
  investment_growth: 'Cumulative total of money you put in (blue) vs. compound interest earned on top (green).',
  assets_liabilities: 'Your total assets and total debts tracked separately over time.',
}

export default function ForecastPage() {
  const { t, i18n } = useTranslation()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [forecasts, setForecasts] = useState<ForecastResult[]>([])
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const [chartView, setChartView] = useState<ChartView>('net_worth')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<Scenario[]>('/scenarios').then(s => {
      setScenarios(s)
      if (s.length > 0) setSelectedIds([s[0].id])
    })
  }, [])

  useEffect(() => {
    if (selectedIds.length === 0) return
    setLoading(true)
    const ids = selectedIds.join(',')
    api.get<ForecastResult[]>(`/forecast/compare?scenario_ids=${ids}&granularity=${granularity}`)
      .then(setForecasts)
      .finally(() => setLoading(false))
  }, [selectedIds, granularity])

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

  // Build chart data with cumulative savings/growth
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
        return point
      })
    : []

  // Year-by-year breakdown from the primary scenario (yearly granularity)
  const primary = forecasts[0]

  // Build yearly rows from monthly data for the table (group by year)
  const yearlyRows = (() => {
    if (!primary) return []
    const byYear: Record<string, { income: number; expenses: number; tax: number; net_worth: number; savings: number }> = {}
    for (const m of primary.months) {
      const yr = m.date_label.slice(0, 4)
      if (!byYear[yr]) byYear[yr] = { income: 0, expenses: 0, tax: 0, net_worth: 0, savings: 0 }
      byYear[yr].income += m.income
      byYear[yr].expenses += m.expenses
      byYear[yr].tax += m.tax
      byYear[yr].net_worth = m.net_worth  // end-of-year snapshot
      byYear[yr].savings += m.savings_contributions
    }
    return Object.entries(byYear).map(([yr, v]) => ({ year: yr, ...v }))
  })()

  const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 6, fontSize: 12 }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('nav.forecast')}</h1>
          <p className="text-xs text-surface-500 mt-0.5">5-year projection based on your scenario assumptions</p>
        </div>
        {/* Granularity */}
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1">
          {(['monthly', 'quarterly', 'yearly'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                granularity === g ? 'bg-surface-600 text-white' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-surface-500">Scenarios:</span>
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => toggleScenario(s.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border transition-colors ${
              selectedIds.includes(s.id)
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-surface-600 text-surface-400 hover:border-surface-500'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
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
      ) : primary ? (
        <>
          {/* Summary cards */}
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-3">
              5-Year Summary — {primary.scenario_name}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Net worth */}
              <div className="card col-span-2 lg:col-span-1">
                <p className="text-xs text-surface-400 uppercase mb-2">Net Worth</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-surface-500">Today</p>
                    <p className="text-base font-bold font-mono">{fmt(primary.summary.starting_net_worth)}</p>
                  </div>
                  <div className="text-center px-2">
                    {primary.summary.net_worth_change >= 0
                      ? <TrendingUp size={18} className="text-green-400 mx-auto" />
                      : <TrendingDown size={18} className="text-red-400 mx-auto" />}
                    <p className={`text-xs font-mono font-bold mt-0.5 ${primary.summary.net_worth_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {primary.summary.net_worth_change >= 0 ? '+' : ''}{fmt(primary.summary.net_worth_change)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-surface-500">In 5 years</p>
                    <p className="text-base font-bold font-mono">{fmt(primary.summary.ending_net_worth)}</p>
                  </div>
                </div>
              </div>

              {/* Income vs Expenses */}
              <div className="card">
                <p className="text-xs text-surface-400 uppercase mb-2">5-Year Income vs Expenses</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Gross income</span>
                    <span className="font-mono text-surface-200">{fmt(primary.summary.total_income)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Taxes paid</span>
                    <span className="font-mono text-orange-400">−{fmt(primary.summary.total_tax)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Expenses</span>
                    <span className="font-mono text-red-400">−{fmt(primary.summary.total_expenses - primary.summary.total_tax)}</span>
                  </div>
                  <div className="border-t border-surface-700 pt-1 flex justify-between text-xs font-semibold">
                    <span className="text-surface-300">Net cash flow</span>
                    <span className={`font-mono ${(primary.summary.total_income - primary.summary.total_expenses) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(primary.summary.total_income - primary.summary.total_expenses)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Savings & Investment */}
              <div className="card">
                <p className="text-xs text-surface-400 uppercase mb-2">Savings & Investment</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Total contributed</span>
                    <span className="font-mono text-blue-400">{fmt(primary.summary.total_savings)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-400">Compound growth</span>
                    <span className="font-mono text-green-400">+{fmt(primary.summary.total_investment_growth)}</span>
                  </div>
                  <div className="border-t border-surface-700 pt-1 flex justify-between text-xs font-semibold">
                    <span className="text-surface-300">Total value</span>
                    <span className="font-mono text-surface-200">{fmt(primary.summary.total_savings + primary.summary.total_investment_growth)}</span>
                  </div>
                  {primary.summary.total_savings > 0 && (
                    <p className="text-[10px] text-surface-500">
                      {Math.round(primary.summary.total_investment_growth / primary.summary.total_savings * 100)}% return on contributions
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chart section */}
          <div className="card p-4">
            {/* Chart tabs + description */}
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex gap-1 flex-wrap">
                {([
                  ['net_worth', 'Net Worth'],
                  ['cash_flow', 'Cash Flow'],
                  ['investment_growth', 'Savings & Growth'],
                  ['assets_liabilities', 'Assets vs Debts'],
                ] as [ChartView, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setChartView(key)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      chartView === key
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-surface-500 flex items-center gap-1.5 mb-4">
              <Info size={11} />
              {CHART_DESCRIPTIONS[chartView]}
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
          </div>

          {/* Year-by-year breakdown table */}
          {yearlyRows.length > 0 && (
            <div className="card p-4">
              <p className="text-xs text-surface-400 uppercase tracking-wide mb-3">Year-by-Year Breakdown — {primary.scenario_name}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-surface-500 border-b border-surface-700">
                    <th className="pb-2 font-medium">Year</th>
                    <th className="pb-2 font-medium text-right">Gross Income</th>
                    <th className="pb-2 font-medium text-right">Expenses</th>
                    <th className="pb-2 font-medium text-right">Tax</th>
                    <th className="pb-2 font-medium text-right">Saved</th>
                    <th className="pb-2 font-medium text-right">Net Worth (Dec)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {yearlyRows.map(row => (
                    <tr key={row.year} className="hover:bg-surface-800/40">
                      <td className="py-2 font-medium text-surface-300">{row.year}</td>
                      <td className="py-2 text-right font-mono text-surface-200">{fmtFull(row.income)}</td>
                      <td className="py-2 text-right font-mono text-red-400">{fmtFull(row.expenses)}</td>
                      <td className="py-2 text-right font-mono text-orange-400">{fmtFull(row.tax)}</td>
                      <td className="py-2 text-right font-mono text-blue-400">{fmtFull(row.savings)}</td>
                      <td className="py-2 text-right font-mono font-semibold text-surface-100">{fmtFull(row.net_worth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
