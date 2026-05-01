import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, Check, X, Users } from 'lucide-react'
import { api } from '../../api/client'
import { useProfileStore, type Profile } from '../../stores/profile'

const PROFILE_COLORS = [
  '#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#A855F7',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
]

export default function ProfilePage() {
  const { profiles, fetchProfiles, activeProfileId, setActiveProfileId } = useProfileStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', color: '#3B82F6', avatar_initial: '' })

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const initial = form.avatar_initial || form.name.trim().charAt(0).toUpperCase()
    await api.post('/profiles', { name: form.name.trim(), color: form.color, avatar_initial: initial })
    setForm({ name: '', color: '#3B82F6', avatar_initial: '' })
    setShowForm(false)
    fetchProfiles()
  }

  const handleUpdate = async () => {
    if (!editingId || !form.name.trim()) return
    const initial = form.avatar_initial || form.name.trim().charAt(0).toUpperCase()
    await api.patch(`/profiles/${editingId}`, { name: form.name.trim(), color: form.color, avatar_initial: initial })
    setEditingId(null)
    setForm({ name: '', color: '#3B82F6', avatar_initial: '' })
    fetchProfiles()
  }

  const handleDelete = async (id: number) => {
    if (profiles.length <= 1) return
    await api.delete(`/profiles/${id}`)
    if (activeProfileId === id) setActiveProfileId(profiles.find(p => p.id !== id)?.id ?? 1)
    fetchProfiles()
  }

  const startEdit = (p: Profile) => {
    setEditingId(p.id)
    setForm({ name: p.name, color: p.color, avatar_initial: p.avatar_initial })
    setShowForm(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Profiles</h1>
          <p className="text-xs text-surface-500 mt-0.5">
            Manage user profiles for separate financial tracking.
            Switch between individual or combined views from the sidebar.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null) }}
          className="btn-primary flex items-center gap-1.5 text-xs py-1.5"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancel' : 'Add profile'}
        </button>
      </div>

      {/* Create / Edit form */}
      {(showForm || editingId) && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-4">
            {editingId ? 'Edit Profile' : 'New Profile'}
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input w-full"
                placeholder="e.g. My Finances, Partner"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Initial (1-2 chars)</label>
              <input
                value={form.avatar_initial}
                onChange={e => setForm({ ...form, avatar_initial: e.target.value.slice(0, 2) })}
                className="input w-full text-center font-bold"
                placeholder={form.name ? form.name.charAt(0).toUpperCase() : 'P'}
              />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Color</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PROFILE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={!form.name.trim()}
              className="btn-primary text-xs"
            >
              {editingId ? 'Save changes' : 'Create profile'}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setForm({ name: '', color: '#3B82F6', avatar_initial: '' }) }}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Profiles grid */}
      <div className="grid grid-cols-2 gap-4">
        {profiles.map(p => (
          <div
            key={p.id}
            className={`card p-5 relative group transition-all ${
              activeProfileId === p.id ? 'ring-2 ring-accent/50' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ background: p.color }}
              >
                {p.avatar_initial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-surface-100 truncate">{p.name}</h3>
                  {activeProfileId === p.id && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-surface-500 mt-0.5">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {activeProfileId !== p.id && (
                  <button
                    onClick={() => setActiveProfileId(p.id)}
                    className="p-1.5 text-surface-500 hover:text-accent transition-colors"
                    title="Switch to this profile"
                  >
                    <Check size={14} />
                  </button>
                )}
                <button
                  onClick={() => startEdit(p)}
                  className="p-1.5 text-surface-500 hover:text-accent transition-colors"
                  title="Edit"
                >
                  <Edit3 size={14} />
                </button>
                {profiles.length > 1 && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-surface-500 hover:text-negative transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Combined view card */}
        <div
          className={`card p-5 cursor-pointer transition-all hover:bg-surface-700/30 ${
            activeProfileId === 'all' ? 'ring-2 ring-purple-500/50' : ''
          }`}
          onClick={() => setActiveProfileId('all')}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-accent to-purple-500 text-white shrink-0">
              <Users size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-surface-100">Combined View</h3>
                {activeProfileId === 'all' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-900/30 text-purple-400 border border-purple-800/40">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                See all profiles' data merged together — household finances at a glance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
