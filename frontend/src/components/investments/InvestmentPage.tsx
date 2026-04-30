import { useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, LineChart, Plus, Search, X, Info } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../api/client'
import type { Account, Holding, FundInfo, LookthroughResult } from '../../api/types'
import { useProfileStore } from '../../stores/profile'

const REGION_COLORS: Record<string, string> = {
  us_equity: '#3b82f6',
  cad_equity: '#ef4444',
  intl_developed_equity: '#a855f7',
  emerging_equity: '#f59e0b',
  cad_bonds: '#22c55e',
  global_bonds: '#06b6d4',
  us_bonds: '#6366f1',
  cash: '#94a3b8',
}

const REGION_LABELS: Record<string, string> = {
  us_equity: 'US Equity',
  cad_equity: 'Canadian Equity',
  intl_developed_equity: 'Intl Developed',
  emerging_equity: 'Emerging Markets',
  cad_bonds: 'Canadian Bonds',
  global_bonds: 'Global Bonds',
  us_bonds: 'US Bonds',
  cash: 'Cash & Equiv.',
}

export default function InvestmentPage() {
  const { t, i18n } = useTranslation()
  const activeProfileId = useProfileStore(s => s.activeProfileId)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [fundSearch, setFundSearch] = useState('')
  const [fundResults, setFundResults] = useState<FundInfo[]>([])
  const [selectedFund, setSelectedFund] = useState<FundInfo | null>(null)
  const [lookthrough, setLookthrough] = useState<LookthroughResult | null>(null)
  const [form, setForm] = useState({
    name: '', account_id: 0, ticker: '', fund_code: '',
    units: '', price_per_unit: '', market_value: '', book_value: '',
  })

  const fmt = (n: number) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
    }).format(n)

  const investmentAccounts = useMemo(
    () => accounts.filter(a => ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'crypto'].includes(a.type)),
    [accounts],
  )

  const refresh = useCallback(() => {
    api.get<Holding[]>('/holdings').then(setHoldings)
    api.get<Account[]>('/accounts').then(setAccounts)
    api.get<LookthroughResult>('/holdings/lookthrough').then(setLookthrough)
  }, [activeProfileId])

  useEffect(() => { refresh() }, [refresh])

  const totalValue = holdings.reduce((s, h) => s + h.market_value, 0)
  const totalBook = holdings.reduce((s, h) => s + (h.book_value ?? h.market_value), 0)
  const totalGain = totalValue - totalBook
  const gainPct = totalBook > 0 ? (totalGain / totalBook) * 100 : 0

  const deleteHolding = async (id: number) => {
    await api.delete(`/holdings/${id}`)
    refresh()
  }

  const searchFunds = async (q: string) => {
    setFundSearch(q)
    if (q.length < 2) { setFundResults([]); return }
    const results = await api.getRaw<FundInfo[]>(`/holdings/funds/search?q=${encodeURIComponent(q)}`)
    setFundResults(results)
  }

  const pickFund = (f: FundInfo) => {
    setSelectedFund(f)
    setForm(prev => ({ ...prev, name: f.name, fund_code: f.code, ticker: f.code }))
    setFundSearch(f.name)
    setFundResults([])
  }

  const resetForm = () => {
    setShowForm(false)
    setSelectedFund(null)
    setFundSearch('')
    setFundResults([])
    setForm({ name: '', account_id: 0, ticker: '', fund_code: '', units: '', price_per_unit: '', market_value: '', book_value: '' })
  }

  const createHolding = async () => {
    const profileId = activeProfileId === 'all' ? 1 : activeProfileId
    const mv = parseFloat(form.market_value) || (parseFloat(form.units) || 0) * (parseFloat(form.price_per_unit) || 0)
    await api.post('/holdings', {
      account_id: form.account_id || investmentAccounts[0]?.id,
      profile_id: profileId,
      name: form.name,
      ticker: form.ticker || undefined,
      fund_code: form.fund_code || undefined,
      units: parseFloat(form.units) || 0,
      price_per_unit: parseFloat(form.price_per_unit) || 0,
      market_value: mv,
      book_value: form.book_value ? parseFloat(form.book_value) : undefined,
    })
    resetForm()
    refresh()
  }

  const acctName = (id: number) => accounts.find(a => a.id === id)?.name ?? '—'

  const getAllocation = (h: Holding): Record<string, number> | null => {
    if (!h.allocation_json) return null
    try { return JSON.parse(h.allocation_json) } catch { return null }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1440px]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.investments')}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={14} /> Add Holding
        </button>
      </div>

      {/* Add Holding Form */}
      {showForm && (
        <div className="card p-5 border-blue-500/20">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-surface-200">Add Investment Holding</p>
            <button onClick={resetForm} className="text-surface-500 hover:text-surface-300"><X size={16} /></button>
          </div>

          {/* Fund search */}
          <div className="mb-4 relative">
            <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Search Fund Database</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
              <input
                className="input w-full pl-9"
                placeholder="Search Fidelity, iShares, Vanguard funds..."
                value={fundSearch}
                onChange={e => searchFunds(e.target.value)}
              />
            </div>
            {fundResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-surface-800/95 backdrop-blur-md rounded-xl border border-surface-700/60 shadow-xl max-h-60 overflow-y-auto">
                {fundResults.map(f => (
                  <button
                    key={f.code}
                    onClick={() => pickFund(f)}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-700/60 transition-colors border-b border-surface-700/30 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-blue-400 mr-2">{f.code}</span>
                        <span className="text-xs text-surface-200">{f.name}</span>
                      </div>
                      <span className="text-[10px] text-surface-500">{f.category}</span>
                    </div>
                    {f.mer && <span className="text-[10px] text-surface-500">MER: {f.mer}%</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected fund info */}
          {selectedFund && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
              <div className="flex items-center gap-2 mb-2">
                <Info size={13} className="text-blue-400" />
                <span className="text-xs font-semibold text-blue-300">{selectedFund.name}</span>
                <span className="text-[10px] text-surface-500 ml-auto">MER: {selectedFund.mer}%</span>
              </div>
              <div className="flex gap-0.5 h-4 rounded-full overflow-hidden mb-2">
                {Object.entries(selectedFund.allocation).map(([k, v]) => (
                  <div key={k} title={`${REGION_LABELS[k] || k}: ${v}%`} className="h-full" style={{ width: `${v}%`, background: REGION_COLORS[k] || '#64748b' }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(selectedFund.allocation).map(([k, v]) => (
                  <span key={k} className="text-[10px] text-surface-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: REGION_COLORS[k] || '#64748b' }} />
                    {REGION_LABELS[k] || k}: {v}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Name *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Fidelity Global Fund" />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Account *</label>
              <select className="input w-full" value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: Number(e.target.value) }))}>
                <option value={0}>Select account...</option>
                {investmentAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Ticker / Fund Code</label>
              <input className="input w-full" value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} placeholder="e.g. XIC, FID500" />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Units</label>
              <input className="input w-full" type="number" value={form.units} onChange={e => setForm(p => ({ ...p, units: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Price per Unit</label>
              <input className="input w-full" type="number" value={form.price_per_unit} onChange={e => setForm(p => ({ ...p, price_per_unit: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Market Value</label>
              <input className="input w-full" type="number" value={form.market_value} onChange={e => setForm(p => ({ ...p, market_value: e.target.value }))} placeholder="Auto from units x price" />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 uppercase tracking-wider font-semibold mb-1.5 block">Book Value (cost basis)</label>
              <input className="input w-full" type="number" value={form.book_value} onChange={e => setForm(p => ({ ...p, book_value: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="btn-secondary text-xs">Cancel</button>
            <button onClick={createHolding} disabled={!form.name} className="btn-primary text-xs disabled:opacity-40">Add Holding</button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <p className="text-[11px] text-surface-400 uppercase tracking-[0.15em] font-semibold">Total Portfolio</p>
          <p className="text-3xl font-bold font-mono mt-2 tracking-tight">{fmt(totalValue)}</p>
          <p className="text-xs text-surface-500 mt-1">{holdings.length} holding{holdings.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 ${totalGain >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`} />
          <p className="text-[11px] text-surface-400 uppercase tracking-[0.15em] font-semibold">Unrealized Gain/Loss</p>
          <p className={`text-3xl font-bold font-mono mt-2 ${totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalGain >= 0 ? '+' : ''}{fmt(totalGain)}
          </p>
          <p className={`text-xs mt-1 ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
          </p>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <p className="text-[11px] text-surface-400 uppercase tracking-[0.15em] font-semibold">Book Value</p>
          <p className="text-3xl font-bold font-mono mt-2 text-surface-300">{fmt(totalBook)}</p>
          <p className="text-xs text-surface-500 mt-1">Cost basis</p>
        </div>
      </div>

      {/* Holdings table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-surface-200">Holdings</p>
        </div>

        {holdings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-surface-500 border-b border-surface-700/40">
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider">Name</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider">Account</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider">Ticker/Fund</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider text-right">Units</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider text-right">Price</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider text-right">Market Value</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider text-right">Gain/Loss</th>
                  <th className="pb-3 font-semibold text-[10px] uppercase tracking-wider">Allocation</th>
                  <th className="pb-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/40">
                {holdings.map(h => {
                  const gain = h.market_value - (h.book_value ?? h.market_value)
                  const alloc = getAllocation(h)
                  return (
                    <tr key={h.id} className="hover:bg-surface-800/30 transition-colors group">
                      <td className="py-3">
                        <p className="font-medium text-surface-200">{h.name}</p>
                        {h.notes && <p className="text-[10px] text-surface-500 mt-0.5">{h.notes}</p>}
                      </td>
                      <td className="py-3 text-surface-400">{acctName(h.account_id)}</td>
                      <td className="py-3">
                        <span className="font-mono text-surface-300">{h.ticker || h.fund_code || '—'}</span>
                      </td>
                      <td className="py-3 text-right font-mono text-surface-300">
                        {h.units > 0 ? h.units.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 text-right font-mono text-surface-300">
                        {h.price_per_unit > 0 ? fmt(h.price_per_unit) : '—'}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-surface-100">
                        {fmt(h.market_value)}
                      </td>
                      <td className={`py-3 text-right font-mono ${gain === 0 ? 'text-surface-500' : gain > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {h.book_value != null ? `${gain > 0 ? '+' : ''}${fmt(gain)}` : '—'}
                      </td>
                      <td className="py-3 pl-3">
                        {alloc ? (
                          <div className="flex gap-0.5 h-3 w-24 rounded-full overflow-hidden">
                            {Object.entries(alloc).map(([k, v]) => (
                              <div
                                key={k}
                                title={`${REGION_LABELS[k] || k}: ${v}%`}
                                className="h-full"
                                style={{ width: `${v}%`, background: REGION_COLORS[k] || '#64748b' }}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-surface-600">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => deleteHolding(h.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <LineChart className="mx-auto text-surface-600 mb-3" size={40} />
            <p className="text-surface-400 text-sm">No holdings yet</p>
            <p className="text-surface-500 text-xs mt-1">Add your investments to see portfolio analysis</p>
          </div>
        )}
      </div>

      {/* Allocation Charts — Geographic + Sector */}
      {lookthrough && lookthrough.total_value > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Geographic Allocation */}
          <div className="card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/4" />
            <p className="text-sm font-semibold text-surface-200 mb-4 relative">Geographic Allocation</p>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={Object.entries(lookthrough.region_allocation).map(([k, v]) => ({ name: REGION_LABELS[k] || k, value: v, key: k }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {Object.entries(lookthrough.region_allocation).map(([k], i) => (
                      <Cell key={i} fill={REGION_COLORS[k] || '#64748b'} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {Object.entries(lookthrough.region_allocation).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: REGION_COLORS[k] || '#64748b' }} />
                      <span className="text-surface-300">{REGION_LABELS[k] || k}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-surface-400">{v.toFixed(1)}%</span>
                      <span className="font-mono text-[11px] text-surface-500">{fmt(lookthrough.total_value * v / 100)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sector Allocation */}
          <div className="card p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <p className="text-sm font-semibold text-surface-200 mb-4 relative">Sector Breakdown</p>
            <div className="relative">
              {Object.keys(lookthrough.sector_allocation).length > 0 ? (
                <>
                  <div className="space-y-2">
                    {Object.entries(lookthrough.sector_allocation).slice(0, 10).map(([k, v], i) => {
                      const colors = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']
                      return (
                        <div key={k}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-surface-300">{lookthrough.sector_labels?.[k] || k}</span>
                            <span className="font-mono text-surface-400">{v.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-surface-800/80 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(v * 2, 100)}%`, background: colors[i % colors.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="text-surface-500 text-sm text-center py-8">No sector data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fund Explorer */}
      {holdings.length > 0 && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-surface-200 mb-3">Fund Composition Details</p>
          <p className="text-xs text-surface-500 mb-4">Click a holding with a known fund code to see what&apos;s inside it.</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {holdings.filter(h => h.allocation_json).map(h => {
              const alloc = getAllocation(h)
              if (!alloc) return null
              const weight = totalValue > 0 ? (h.market_value / totalValue) * 100 : 0
              return (
                <div key={h.id} className="p-3 rounded-lg bg-surface-800/40 border border-surface-700/30 hover:border-surface-600/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-surface-200 truncate">{h.name}</p>
                    <span className="text-[10px] font-mono text-surface-500 shrink-0 ml-2">{weight.toFixed(1)}% of portfolio</span>
                  </div>
                  <div className="flex gap-0.5 h-3 rounded-full overflow-hidden mb-2">
                    {Object.entries(alloc).map(([k, v]) => (
                      <div key={k} title={`${REGION_LABELS[k] || k}: ${v}%`} className="h-full" style={{ width: `${v}%`, background: REGION_COLORS[k] || '#64748b' }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {Object.entries(alloc).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-surface-500">
                        {REGION_LABELS[k] || k}: {v}%
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
