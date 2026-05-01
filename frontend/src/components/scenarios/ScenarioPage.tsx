import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Copy, Trash2, AlertTriangle, ChevronRight } from 'lucide-react'
import { api } from '../../api/client'
import type { Scenario } from '../../api/types'
import { useProfileStore } from '../../stores/profile'
import ScenarioDetail from './ScenarioDetail'

interface StressPreset {
  id: number
  name: string
  description: string
}

export default function ScenarioPage() {
  const { t } = useTranslation()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [presets, setPresets] = useState<StressPreset[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const activeProfileId = useProfileStore(s => s.activeProfileId)

  const fetchScenarios = async () => {
    const data = await api.get<Scenario[]>('/scenarios')
    setScenarios(data)
  }

  useEffect(() => {
    fetchScenarios()
    api.get<StressPreset[]>('/scenarios/presets/stress-tests').then(setPresets)
  }, [activeProfileId])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const s = await api.post<Scenario>('/scenarios', { name: newName.trim(), profile_id: activeProfileId === 'all' ? 1 : activeProfileId })
    setNewName('')
    setCreating(false)
    fetchScenarios()
    setSelectedId(s.id)
  }

  const handleClone = async (id: number) => {
    await api.post(`/scenarios/${id}/clone`)
    fetchScenarios()
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/scenarios/${id}`)
    if (selectedId === id) setSelectedId(null)
    fetchScenarios()
  }

  if (selectedId) {
    return (
      <ScenarioDetail
        scenarioId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('nav.scenarios')}</h1>
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              placeholder="Scenario name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="input w-56"
            />
            <button onClick={handleCreate} className="btn-primary">{t('common.save')}</button>
            <button onClick={() => setCreating(false)} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} />
            New scenario
          </button>
        )}
      </div>

      {scenarios.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-500 mb-3">No scenarios yet. Create one to start forecasting.</p>
          <button onClick={() => setCreating(true)} className="btn-primary">Create first scenario</button>
        </div>
      ) : (
        <div className="space-y-2">
          {scenarios.map(s => (
            <div key={s.id} className="card flex items-center justify-between py-3 cursor-pointer hover:border-surface-500 transition-colors" onClick={() => setSelectedId(s.id)}>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-surface-400">{s.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => handleClone(s.id)} className="p-1.5 text-surface-500 hover:text-surface-200 hover:bg-surface-800 rounded" title="Clone">
                  <Copy size={14} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-surface-500 hover:text-negative hover:bg-surface-800 rounded" title="Delete">
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={14} className="text-surface-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stress test presets */}
      {scenarios.length > 0 && presets.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle size={14} />
            Stress Test Presets
          </h2>
          <p className="text-xs text-surface-500 mb-3">Select a scenario, then apply a stress test to create a modified clone.</p>
          <div className="grid grid-cols-3 gap-3">
            {presets.map(p => (
              <div key={p.id} className="card py-3">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-surface-400 mt-1">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
