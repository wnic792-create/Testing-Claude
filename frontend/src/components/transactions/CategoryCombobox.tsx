import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Check } from 'lucide-react'
import type { Category } from '../../api/types'

interface CategoryComboboxProps {
  value: number | null
  categories: Category[]
  language: string
  onChange: (categoryId: number | null) => void
  onCreateCategory: (name: string) => Promise<Category>
}

/**
 * Inline category picker with search + create.
 * - Click the trigger to open a searchable dropdown.
 * - Type to filter by name (EN or FR).
 * - If the typed text doesn't match any category, a "+ Create '<text>'" row
 *   appears at the top. Clicking it creates a new category and selects it.
 */
export default function CategoryCombobox({
  value,
  categories,
  language,
  onChange,
  onCreateCategory,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const labelOf = (c: Category) =>
    language === 'fr' && c.name_fr ? c.name_fr : c.name

  const current = useMemo(
    () => (value != null ? categories.find(c => c.id === value) : null),
    [value, categories],
  )

  // Build parent lookup for nicer labels
  const parentOf = useMemo(() => {
    const m: Record<number, Category | undefined> = {}
    for (const c of categories) {
      if (c.parent_id) m[c.id] = categories.find(x => x.id === c.parent_id)
    }
    return m
  }, [categories])

  // Only sub-categories are pickable (parents are groupers). But if user has
  // top-level categories without children (e.g. "Uncategorized"), include them.
  const pickable = useMemo(() => {
    const hasChildren = new Set(categories.filter(c => c.parent_id).map(c => c.parent_id))
    return categories.filter(c => c.parent_id !== null || !hasChildren.has(c.id))
  }, [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pickable
    return pickable.filter(c => {
      const name = c.name.toLowerCase()
      const nameFr = (c.name_fr || '').toLowerCase()
      const parent = parentOf[c.id]
      const parentName = (parent?.name || '').toLowerCase()
      return name.includes(q) || nameFr.includes(q) || parentName.includes(q)
    })
  }, [query, pickable, parentOf])

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return pickable.find(
      c => c.name.toLowerCase() === q || (c.name_fr || '').toLowerCase() === q,
    )
  }, [query, pickable])

  const canCreate = query.trim().length >= 2 && !exactMatch

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const inTrigger = containerRef.current?.contains(e.target as Node)
      const inMenu = menuRef.current?.contains(e.target as Node)
      if (!inTrigger && !inMenu) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Position the menu when it opens; flip above trigger when near the bottom.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const MENU_HEIGHT = 320
    const spaceBelow = window.innerHeight - rect.bottom
    const above = spaceBelow < MENU_HEIGHT && rect.top > MENU_HEIGHT
    setMenuPos({
      top: above ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
      left: rect.left,
      above,
    })
  }, [open])

  useEffect(() => {
    if (open) {
      // Focus the search input when opening
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handleSelect = (categoryId: number | null) => {
    onChange(categoryId)
    setOpen(false)
    setQuery('')
  }

  const handleCreate = async () => {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const cat = await onCreateCategory(name)
      onChange(cat.id)
    } finally {
      setCreating(false)
      setOpen(false)
      setQuery('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (exactMatch) {
        handleSelect(exactMatch.id)
      } else if (canCreate) {
        handleCreate()
      } else if (filtered.length === 1) {
        handleSelect(filtered[0].id)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const currentLabel = current
    ? parentOf[current.id]
      ? `${labelOf(parentOf[current.id]!)} › ${labelOf(current)}`
      : labelOf(current)
    : '—'

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left border rounded px-1.5 py-0.5 text-xs transition-colors ${
          current
            ? 'border-surface-700 text-surface-200'
            : 'border-dashed border-surface-600 text-surface-500 italic'
        } hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
      >
        <span className="truncate block">{currentLabel}</span>
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            width: 256,
          }}
          className="z-50 bg-surface-800 border border-surface-600 rounded shadow-xl max-h-80 overflow-hidden flex flex-col">
          <div className="p-1.5 border-b border-surface-700">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or type new category..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto">
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-green-400 hover:bg-surface-700 disabled:opacity-50"
              >
                <Plus size={12} />
                {creating ? 'Creating...' : `Create "${query.trim()}"`}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-400 hover:bg-surface-700"
            >
              {value === null && <Check size={12} />}
              <span className={value === null ? '' : 'ml-4'}>— (no category)</span>
            </button>

            {filtered.length === 0 && !canCreate ? (
              <div className="px-3 py-2 text-xs text-surface-500 italic">
                No matches. Type at least 2 chars to create a new category.
              </div>
            ) : (
              filtered.map(c => {
                const parent = parentOf[c.id]
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-200 hover:bg-surface-700"
                  >
                    {c.id === value && <Check size={12} className="text-blue-400" />}
                    <span className={c.id === value ? '' : 'ml-4'}>
                      {parent && (
                        <span className="text-surface-500">{labelOf(parent)} › </span>
                      )}
                      {labelOf(c)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
