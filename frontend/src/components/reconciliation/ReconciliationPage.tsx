import { useState, useCallback } from 'react'
import { Plus, Trash2, ClipboardPaste, Play, RotateCcw } from 'lucide-react'

interface TxRow {
  id: string
  date: string
  description: string
  amount: string
  reference: string
}

type MatchStatus = 'matched' | 'missing' | 'unmatched'

interface ResultRow {
  status: MatchStatus
  expected?: TxRow
  actual?: TxRow
  amount: number
}

const blankRow = (): TxRow => ({
  id: crypto.randomUUID(),
  date: '',
  description: '',
  amount: '',
  reference: '',
})

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n)

const STATUS_BADGE: Record<MatchStatus, { icon: string; label: string; classes: string }> = {
  matched:   { icon: '✅', label: 'Matched',   classes: 'bg-accent/10 text-accent border-accent/20' },
  missing:   { icon: '❌', label: 'Missing',   classes: 'bg-negative/10 text-negative border-negative/20' },
  unmatched: { icon: '⚠️', label: 'Unmatched', classes: 'bg-amber-900/30 text-amber-400 border-amber-800/50' },
}

function parsePastedCSV(text: string): TxRow[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Support tab-delimited and comma-delimited
      const parts = line.includes('\t') ? line.split('\t') : line.split(',')
      const cleaned = parts.map(p => p.trim().replace(/^"|"$/g, ''))
      return {
        id: crypto.randomUUID(),
        date: cleaned[0] ?? '',
        description: cleaned[1] ?? '',
        amount: cleaned[2] ?? '',
        reference: cleaned[3] ?? '',
      }
    })
}

function reconcile(expected: TxRow[], actual: TxRow[]): ResultRow[] {
  const validExpected = expected.filter(r => r.amount.trim() !== '')
  const validActual = actual.filter(r => r.amount.trim() !== '')

  const actualUsed = new Set<string>()
  const results: ResultRow[] = []

  for (const exp of validExpected) {
    const expAmt = parseFloat(exp.amount)
    if (isNaN(expAmt)) continue

    // Try to find a match: same amount + (matching reference OR similar description)
    const match = validActual.find(act => {
      if (actualUsed.has(act.id)) return false
      const actAmt = parseFloat(act.amount)
      if (isNaN(actAmt)) return false
      if (Math.abs(expAmt - actAmt) > 0.01) return false
      // Reference match (non-empty and equal)
      if (exp.reference && act.reference && exp.reference.trim().toLowerCase() === act.reference.trim().toLowerCase()) return true
      // Description match (case-insensitive substring)
      if (exp.description && act.description) {
        const e = exp.description.trim().toLowerCase()
        const a = act.description.trim().toLowerCase()
        if (e === a || a.includes(e) || e.includes(a)) return true
      }
      // Same amount with at least one having an empty reference — still match
      if (!exp.reference && !act.reference) return true
      return false
    })

    if (match) {
      actualUsed.add(match.id)
      results.push({ status: 'matched', expected: exp, actual: match, amount: expAmt })
    } else {
      results.push({ status: 'missing', expected: exp, amount: expAmt })
    }
  }

  // Remaining actuals that were never matched
  for (const act of validActual) {
    if (actualUsed.has(act.id)) continue
    const actAmt = parseFloat(act.amount)
    if (isNaN(actAmt)) continue
    results.push({ status: 'unmatched', actual: act, amount: actAmt })
  }

  return results
}

export default function ReconciliationPage() {
  const [expected, setExpected] = useState<TxRow[]>([blankRow()])
  const [actual, setActual] = useState<TxRow[]>([blankRow()])
  const [results, setResults] = useState<ResultRow[] | null>(null)
  const [pasteTarget, setPasteTarget] = useState<'expected' | 'actual' | null>(null)
  const [pasteText, setPasteText] = useState('')

  const updateRow = (side: 'expected' | 'actual', id: string, field: keyof TxRow, value: string) => {
    const setter = side === 'expected' ? setExpected : setActual
    setter(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const addRow = (side: 'expected' | 'actual') => {
    const setter = side === 'expected' ? setExpected : setActual
    setter(prev => [...prev, blankRow()])
  }

  const removeRow = (side: 'expected' | 'actual', id: string) => {
    const setter = side === 'expected' ? setExpected : setActual
    setter(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  const handlePaste = useCallback(() => {
    if (!pasteTarget || !pasteText.trim()) return
    const rows = parsePastedCSV(pasteText)
    if (rows.length === 0) return
    const setter = pasteTarget === 'expected' ? setExpected : setActual
    setter(prev => {
      const empty = prev.every(r => !r.date && !r.description && !r.amount && !r.reference)
      return empty ? rows : [...prev, ...rows]
    })
    setPasteText('')
    setPasteTarget(null)
  }, [pasteTarget, pasteText])

  const runReconcile = () => {
    setResults(reconcile(expected, actual))
  }

  const reset = () => {
    setExpected([blankRow()])
    setActual([blankRow()])
    setResults(null)
  }

  const matched = results?.filter(r => r.status === 'matched') ?? []
  const missing = results?.filter(r => r.status === 'missing') ?? []
  const unmatched = results?.filter(r => r.status === 'unmatched') ?? []
  const expectedTotal = results?.filter(r => r.expected).reduce((s, r) => s + r.amount, 0) ?? 0
  const actualTotal = results?.filter(r => r.actual).reduce((s, r) => s + (parseFloat(r.actual!.amount) || 0), 0) ?? 0
  const discrepancy = actualTotal - expectedTotal

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transaction Reconciliation</h1>
          <p className="text-xs text-surface-500 mt-0.5">
            Compare expected vs. actual transactions to find discrepancies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={runReconcile}
            disabled={expected.every(r => !r.amount) && actual.every(r => !r.amount)}
            className="btn-primary flex items-center gap-1.5 text-xs py-1.5"
          >
            <Play size={13} /> Reconcile
          </button>
        </div>
      </div>

      {/* Two-side entry */}
      <div className="grid grid-cols-2 gap-4">
        <EntryPanel
          title="Expected Transactions"
          subtitle="Transactions that should have gone through"
          rows={expected}
          onUpdate={(id, field, val) => updateRow('expected', id, field, val)}
          onAdd={() => addRow('expected')}
          onRemove={id => removeRow('expected', id)}
          onPaste={() => setPasteTarget('expected')}
          accentColor="blue"
        />
        <EntryPanel
          title="Actual Transactions"
          subtitle="Transactions that actually went through"
          rows={actual}
          onUpdate={(id, field, val) => updateRow('actual', id, field, val)}
          onAdd={() => addRow('actual')}
          onRemove={id => removeRow('actual', id)}
          onPaste={() => setPasteTarget('actual')}
          accentColor="purple"
        />
      </div>

      {/* CSV paste modal */}
      {pasteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setPasteTarget(null)}>
          <div className="bg-surface-900 border border-surface-700 rounded-lg p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-surface-100 mb-1">
              Paste CSV — {pasteTarget === 'expected' ? 'Expected' : 'Actual'} side
            </p>
            <p className="text-xs text-surface-500 mb-3">
              Paste rows as: <span className="font-mono text-surface-400">date, description, amount, reference</span>
              <br />Supports comma-separated or tab-separated. One transaction per line.
            </p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"2024-01-15, Netflix, 18.99, REF001\n2024-01-16, Spotify, 11.99, REF002"}
              rows={8}
              className="input w-full font-mono text-xs mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setPasteTarget(null); setPasteText('') }} className="btn-secondary text-xs py-1.5">Cancel</button>
              <button onClick={handlePaste} className="btn-primary text-xs py-1.5">Import rows</button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-3">
            <SummaryCard label="Total Expected" value={fmt(expectedTotal)} color="text-surface-100" />
            <SummaryCard label="Total Actual" value={fmt(actualTotal)} color="text-surface-100" />
            <SummaryCard
              label="Matched"
              value={`${matched.length} txn — ${fmt(matched.reduce((s, r) => s + r.amount, 0))}`}
              color="text-accent"
            />
            <SummaryCard
              label="Missing"
              value={`${missing.length} txn — ${fmt(missing.reduce((s, r) => s + r.amount, 0))}`}
              color="text-negative"
            />
            <SummaryCard
              label="Net Discrepancy"
              value={fmt(discrepancy)}
              color={Math.abs(discrepancy) < 0.01 ? 'text-accent' : 'text-amber-400'}
            />
          </div>

          {/* Results table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest">
                Reconciliation Results — {results.length} rows
              </p>
              <div className="flex gap-3 text-xs">
                <span className="text-accent">✅ {matched.length} matched</span>
                <span className="text-negative">❌ {missing.length} missing</span>
                <span className="text-amber-400">⚠️ {unmatched.length} unmatched</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-surface-500 border-b border-surface-700 bg-surface-800/50">
                    <th className="px-4 py-2.5 font-medium w-28">Status</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Reference</th>
                    <th className="px-4 py-2.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/60">
                  {results.map((r, i) => {
                    const badge = STATUS_BADGE[r.status]
                    const tx = r.expected ?? r.actual!
                    const amt = parseFloat(tx.amount) || 0
                    return (
                      <tr key={i} className="hover:bg-surface-800/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.classes}`}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-surface-300">{tx.date || '—'}</td>
                        <td className="px-4 py-2.5 text-surface-200 font-medium max-w-[200px] truncate" title={tx.description}>
                          {tx.description || '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                          r.status === 'matched' ? 'text-accent' : r.status === 'missing' ? 'text-negative' : 'text-amber-400'
                        }`}>
                          {fmt(amt)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-surface-400">{tx.reference || '—'}</td>
                        <td className="px-4 py-2.5 text-surface-500 text-[11px]">
                          {r.status === 'matched' && r.actual && r.expected
                            ? r.actual.date !== r.expected.date
                              ? `Date differs: expected ${r.expected.date}, got ${r.actual.date}`
                              : 'Exact match'
                            : r.status === 'missing'
                              ? 'Expected but not found in actuals'
                              : 'Not in expected list'}
                        </td>
                      </tr>
                    )
                  })}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-surface-500">
                        No transactions to compare. Add entries to both sides and click Reconcile.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EntryPanel({ title, subtitle, rows, onUpdate, onAdd, onRemove, onPaste, accentColor }: {
  title: string
  subtitle: string
  rows: TxRow[]
  onUpdate: (id: string, field: keyof TxRow, value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onPaste: () => void
  accentColor: 'blue' | 'purple'
}) {
  const borderColor = accentColor === 'blue' ? 'border-t-accent' : 'border-t-purple-500'

  return (
    <div className={`card p-0 overflow-hidden border-t-2 ${borderColor}`}>
      <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-surface-100">{title}</p>
          <p className="text-[11px] text-surface-500">{subtitle}</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onPaste} className="btn-secondary flex items-center gap-1 text-[11px] px-2 py-1" title="Paste CSV">
            <ClipboardPaste size={12} /> Paste CSV
          </button>
          <button onClick={onAdd} className="btn-primary flex items-center gap-1 text-[11px] px-2 py-1">
            <Plus size={12} /> Add row
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-surface-500 border-b border-surface-700 bg-surface-800/30">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800/50">
            {rows.map(row => (
              <tr key={row.id} className="group">
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    value={row.date}
                    onChange={e => onUpdate(row.id, 'date', e.target.value)}
                    className="input text-xs py-1 px-1.5 w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={row.description}
                    onChange={e => onUpdate(row.id, 'description', e.target.value)}
                    placeholder="Description"
                    className="input text-xs py-1 px-1.5 w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={e => onUpdate(row.id, 'amount', e.target.value)}
                    placeholder="0.00"
                    className="input text-xs py-1 px-1.5 w-24 text-right font-mono"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={row.reference}
                    onChange={e => onUpdate(row.id, 'reference', e.target.value)}
                    placeholder="Ref ID"
                    className="input text-xs py-1 px-1.5 w-full font-mono"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => onRemove(row.id)}
                    className="text-surface-600 hover:text-negative opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-surface-700 flex items-center justify-between text-[11px] text-surface-500">
        <span>{rows.filter(r => r.amount.trim() !== '').length} of {rows.length} rows with amounts</span>
        <span className="font-mono">
          Total: {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
            rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
          )}
        </span>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3">
      <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
    </div>
  )
}
