import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Tag, Zap } from 'lucide-react'
import { api } from '../../api/client'
import type { Category } from '../../api/types'

interface Rule {
  id: number
  pattern: string
  category_id: number
  priority: number
  source: string
  match_count: number
}

export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<'categories' | 'rules'>('categories')

  // --- Categories state ---
  const [categories, setCategories] = useState<Category[]>([])
  const [catForm, setCatForm] = useState({ name: '', name_fr: '', type: 'expense', parent_id: '' })

  // --- Rules state ---
  const [rules, setRules] = useState<Rule[]>([])
  const [ruleForm, setRuleForm] = useState({ pattern: '', category_id: '', priority: '10' })

  const fetchAll = () => {
    api.get<Category[]>('/categories/flat').then(setCategories)
    api.get<Rule[]>('/categories/rules').then(setRules)
  }

  useEffect(() => { fetchAll() }, [])

  const flatCategories = categories.filter(c => c.parent_id !== null)
  const parentCategories = categories.filter(c => c.parent_id === null)

  const catName = (c: Category) =>
    i18n.language === 'fr' && c.name_fr ? c.name_fr : c.name

  const catById = Object.fromEntries(categories.map(c => [c.id, c]))

  // --- Category actions ---
  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return
    await api.post('/categories', {
      name: catForm.name.trim(),
      name_fr: catForm.name_fr.trim() || null,
      type: catForm.type,
      parent_id: catForm.parent_id ? Number(catForm.parent_id) : null,
    })
    setCatForm({ name: '', name_fr: '', type: 'expense', parent_id: '' })
    fetchAll()
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Delete this category? Transactions in this category will become uncategorized.')) return
    await api.delete(`/categories/${id}`)
    fetchAll()
  }

  // --- Rule actions ---
  const handleAddRule = async () => {
    if (!ruleForm.pattern.trim() || !ruleForm.category_id) return
    await api.post('/categories/rules', {
      pattern: ruleForm.pattern.trim(),
      category_id: Number(ruleForm.category_id),
      priority: Number(ruleForm.priority) || 10,
    })
    setRuleForm({ pattern: '', category_id: '', priority: '10' })
    fetchAll()
  }

  const handleDeleteRule = async (id: number) => {
    await api.delete(`/categories/rules/${id}`)
    fetchAll()
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Categories & Rules</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-surface-700">
        <button
          onClick={() => setTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${
            tab === 'categories'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <Tag size={14} />
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${
            tab === 'rules'
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <Zap size={14} />
          Auto-categorization Rules ({rules.length})
        </button>
      </div>

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <div>
          {/* Add form */}
          <div className="card mb-6">
            <p className="text-sm font-medium mb-3">Add Category</p>
            <div className="grid grid-cols-5 gap-3">
              <input
                placeholder="Name (EN)"
                value={catForm.name}
                onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                className="input"
              />
              <input
                placeholder="Nom (FR) — optional"
                value={catForm.name_fr}
                onChange={e => setCatForm({ ...catForm, name_fr: e.target.value })}
                className="input"
              />
              <select
                value={catForm.type}
                onChange={e => setCatForm({ ...catForm, type: e.target.value })}
                className="input"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
              <select
                value={catForm.parent_id}
                onChange={e => setCatForm({ ...catForm, parent_id: e.target.value })}
                className="input"
              >
                <option value="">No parent (top-level)</option>
                {parentCategories.map(c => (
                  <option key={c.id} value={c.id}>{catName(c)}</option>
                ))}
              </select>
              <button
                onClick={handleAddCategory}
                disabled={!catForm.name.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-40"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

          {/* Category list grouped by parent */}
          <div className="space-y-4">
            {parentCategories.map(parent => {
              const children = categories.filter(c => c.parent_id === parent.id)
              return (
                <div key={parent.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-surface-200">
                      {catName(parent)}
                      <span className="ml-2 text-xs text-surface-500 font-normal">{parent.type}</span>
                    </span>
                    {!parent.is_system && (
                      <button
                        onClick={() => handleDeleteCategory(parent.id)}
                        className="text-surface-500 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {children.map(child => (
                      <div
                        key={child.id}
                        className="flex items-center gap-1.5 bg-surface-800 rounded px-2 py-1 text-xs text-surface-300"
                      >
                        <span>{catName(child)}</span>
                        {!child.is_system && (
                          <button
                            onClick={() => handleDeleteCategory(child.id)}
                            className="text-surface-500 hover:text-red-400 ml-1"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                    {children.length === 0 && (
                      <span className="text-xs text-surface-600 italic">No sub-categories</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── RULES TAB ── */}
      {tab === 'rules' && (
        <div>
          <div className="card mb-6">
            <p className="text-sm font-medium mb-1">Add Rule</p>
            <p className="text-xs text-surface-500 mb-3">
              Pattern is a regex matched against the transaction description (case-insensitive).
              E.g. <code className="bg-surface-800 px-1 rounded">depanneur|dépanneur|convenience</code>
            </p>
            <div className="grid grid-cols-4 gap-3">
              <input
                placeholder="Regex pattern"
                value={ruleForm.pattern}
                onChange={e => setRuleForm({ ...ruleForm, pattern: e.target.value })}
                className="input col-span-2 font-mono text-sm"
              />
              <select
                value={ruleForm.category_id}
                onChange={e => setRuleForm({ ...ruleForm, category_id: e.target.value })}
                className="input"
              >
                <option value="">Select category…</option>
                {parentCategories.map(parent => (
                  <optgroup key={parent.id} label={catName(parent)}>
                    {categories.filter(c => c.parent_id === parent.id).map(child => (
                      <option key={child.id} value={child.id}>{catName(child)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Priority"
                  value={ruleForm.priority}
                  onChange={e => setRuleForm({ ...ruleForm, priority: e.target.value })}
                  className="input w-24"
                  title="Higher priority rules are checked first"
                />
                <button
                  onClick={handleAddRule}
                  disabled={!ruleForm.pattern.trim() || !ruleForm.category_id}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Rules table */}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-800">
                <tr className="text-left text-xs text-surface-400 uppercase tracking-wider">
                  <th className="px-4 py-2">Pattern</th>
                  <th className="px-4 py-2 w-48">Category</th>
                  <th className="px-4 py-2 w-20 text-center">Priority</th>
                  <th className="px-4 py-2 w-20 text-center">Matches</th>
                  <th className="px-4 py-2 w-20 text-center">Source</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-surface-500 text-sm">
                      No rules yet. Add one above or manually categorize a transaction to learn automatically.
                    </td>
                  </tr>
                ) : (
                  rules.map(rule => {
                    const cat = catById[rule.category_id]
                    return (
                      <tr key={rule.id} className="hover:bg-surface-800/40">
                        <td className="px-4 py-2 font-mono text-xs text-surface-300 max-w-xs truncate" title={rule.pattern}>
                          {rule.pattern}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {cat ? catName(cat) : `#${rule.category_id}`}
                        </td>
                        <td className="px-4 py-2 text-xs text-center text-surface-400">{rule.priority}</td>
                        <td className="px-4 py-2 text-xs text-center text-surface-400">{rule.match_count}</td>
                        <td className="px-4 py-2 text-xs text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            rule.source === 'learned'
                              ? 'bg-green-900/50 text-green-400'
                              : 'bg-surface-700 text-surface-400'
                          }`}>
                            {rule.source}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-surface-500 hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
