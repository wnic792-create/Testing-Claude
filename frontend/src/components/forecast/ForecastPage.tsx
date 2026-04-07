import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar,
} from 'recharts'
import { api } from '../../api/client'
import type { Scenario } from '../../api/types'

interface ForecastMonth {
  month: number
  date_label: string
  income: number
  expenses: number
  tax: number
  net_cash_flow: number
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
  }
}

type Granularity = 'monthly' | 'quarterly' | 'yearly'
type ChartView = 'net_worth' | 'cash_flow' | 'assets_liabilities'

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

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 0,
    }).format(n)

  // Merge forecast data for charting
  const chartData = forecasts.length > 0
    ? forecasts[0].months.map((m, i) => {
        const point: Record<string, string | number> = { date: m.date_label }
        for (const f of forecasts) {
          const fm = f.months[i]
          if (!fm) continue
          const prefix = f.scenario_name
          point[`${prefix}_nw`] = fm.net_worth
          point[`${prefix}_assets`] = fm.assets
          point[`${prefix}_liab`] = fm.liabilities
          point[`${prefix}_income`] = fm.income
          point[`${prefix}_expenses`] = fm.expenses
          point[`${prefix}_cashflow`] = fm.net_cash_flow
        }
        return point
      })
    : []

  const primary = forecasts[0]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('nav.forecast')}</h1>
        <div className="flex items-center gap-2">
          {(['monthly', 'quarterly', 'yearly'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                granularity === g ? 'bg-blue-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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
        <div className="card text-center py-12">
          <p className="text-surface-500">Create a scenario to see your forecast.</p>
        </div>
      ) : loading ? (
        <div className="card text-center py-12">
          <p className="text-surface-500">{t('common.loading')}</p>
        </div>
      ) : forecasts.length > 0 ? (
        <>
          {/* Summary cards (first selected scenario) */}
          {primary && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="card">
                <p className="text-xs text-surface-400 uppercase">Starting NW</p>
                <p className="text-lg font-bold font-mono mt-1">{formatCurrency(primary.summary.starting_net_worth)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-surface-400 uppercase">Ending NW (5yr)</p>
                <p className="text-lg font-bold font-mono mt-1">{formatCurrency(primary.summary.ending_net_worth)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-surface-400 uppercase">NW Change</p>
                <p className={`text-lg font-bold font-mono mt-1 ${primary.summary.net_worth_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(primary.summary.net_worth_change)}
                </p>
              </div>
              <div className="card">
                <p className="text-xs text-surface-400 uppercase">Total Tax (5yr)</p>
                <p className="text-lg font-bold font-mono text-orange-400 mt-1">{formatCurrency(primary.summary.total_tax)}</p>
              </div>
            </div>
          )}

          {/* Chart view tabs */}
          <div className="flex gap-1 mb-4">
            {([
              ['net_worth', 'Net Worth'],
              ['cash_flow', 'Cash Flow'],
              ['assets_liabilities', 'Assets vs Liabilities'],
            ] as [ChartView, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChartView(key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  chartView === key ? 'bg-surface-700 text-surface-100' : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="card p-4" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'net_worth' ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend />
                  {forecasts.map(f => (
                    <Area
                      key={f.scenario_id}
                      type="monotone"
                      dataKey={`${f.scenario_name}_nw`}
                      name={f.scenario_name}
                      stroke={f.scenario_color}
                      fill={f.scenario_color}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              ) : chartView === 'cash_flow' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend />
                  {forecasts.map(f => (
                    <Bar
                      key={f.scenario_id}
                      dataKey={`${f.scenario_name}_cashflow`}
                      name={f.scenario_name}
                      fill={f.scenario_color}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend />
                  {forecasts.map(f => (
                    <Line key={`${f.scenario_id}_a`} type="monotone" dataKey={`${f.scenario_name}_assets`} name={`${f.scenario_name} Assets`} stroke="#22c55e" strokeWidth={2} dot={false} />
                  ))}
                  {forecasts.map(f => (
                    <Line key={`${f.scenario_id}_l`} type="monotone" dataKey={`${f.scenario_name}_liab`} name={`${f.scenario_name} Liabilities`} stroke="#ef4444" strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  )
}
