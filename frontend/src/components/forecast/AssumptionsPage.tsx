import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import { api } from '../../api/client'
import type { Scenario } from '../../api/types'

interface Assumptions {
  id: number
  scenario_id: number
  inflation_rate: number
  salary_growth_rate: number
  investment_return_rate: number
  tax_config_year: string
  rrsp_room: number
  tfsa_room: number
  fhsa_room: number
  fx_rate_cad_usd: number
}

export default function AssumptionsPage() {
  const { t } = useTranslation()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get<Scenario[]>('/scenarios').then(s => {
      setScenarios(s)
      if (s.length > 0 && !selectedId) setSelectedId(s[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedId) {
      api.get<Assumptions>(`/forecast/${selectedId}/assumptions`).then(setAssumptions).catch(() => setAssumptions(null))
    }
  }, [selectedId])

  const handleSave = async () => {
    if (!assumptions || !selectedId) return
    setSaving(true)
    const { id, scenario_id, ...updates } = assumptions
    await api.patch(`/forecast/${selectedId}/assumptions`, updates)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = (field: keyof Assumptions, value: number | string) => {
    if (!assumptions) return
    setAssumptions({ ...assumptions, [field]: value })
    setSaved(false)
  }

  if (scenarios.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">{t('nav.assumptions')}</h1>
        <div className="card text-center py-12">
          <p className="text-surface-500">Create a scenario first to set assumptions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{t('nav.assumptions')}</h1>
          <select
            value={selectedId || ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            className="input"
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={14} />
          {saved ? 'Saved' : saving ? 'Saving...' : t('common.save')}
        </button>
      </div>

      {assumptions && (
        <div className="grid grid-cols-2 gap-6">
          {/* Growth & Rates */}
          <div className="card">
            <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-4">Growth & Rates</h2>
            <div className="space-y-3">
              <Field label="Inflation Rate (%)" value={assumptions.inflation_rate} onChange={v => update('inflation_rate', v)} />
              <Field label="Salary Growth Rate (%)" value={assumptions.salary_growth_rate} onChange={v => update('salary_growth_rate', v)} />
              <Field label="Default Investment Return (%)" value={assumptions.investment_return_rate} onChange={v => update('investment_return_rate', v)} />
              <Field label="CAD/USD Exchange Rate" value={assumptions.fx_rate_cad_usd} onChange={v => update('fx_rate_cad_usd', v)} step={0.01} />
            </div>
          </div>

          {/* Contribution Room */}
          <div className="card">
            <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-4">Contribution Room</h2>
            <div className="space-y-3">
              <Field label="RRSP Room ($)" value={assumptions.rrsp_room} onChange={v => update('rrsp_room', v)} step={100} />
              <Field label="TFSA Room ($)" value={assumptions.tfsa_room} onChange={v => update('tfsa_room', v)} step={100} />
              <Field label="FHSA Room ($)" value={assumptions.fhsa_room} onChange={v => update('fhsa_room', v)} step={100} />
            </div>
          </div>

          {/* Tax Config */}
          <div className="card col-span-2">
            <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-4">Tax Configuration</h2>
            <div className="flex items-center gap-4">
              <label className="text-sm text-surface-400">Tax bracket year</label>
              <select
                value={assumptions.tax_config_year}
                onChange={e => update('tax_config_year', e.target.value)}
                className="input w-32"
              >
                <option value="2025">2025</option>
              </select>
              <span className="text-xs text-surface-500">Federal + Quebec brackets, QPP, EI, QPIP rates</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, step = 0.1 }: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-surface-300">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="input w-32 text-right font-mono"
      />
    </div>
  )
}
