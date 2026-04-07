import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import type { Scenario, Account } from '../../api/types'

interface IncomeStream {
  id: number; name: string; amount: number; frequency: string
  start_month: number; end_month: number | null; growth_rate: number | null
  income_type: string; account_id: number | null
}

interface RecurringExpense {
  id: number; name: string; amount: number; frequency: string
  start_month: number; end_month: number | null; inflation_adjusted: boolean
  account_id: number | null
}

interface OneOffEvent {
  id: number; name: string; amount: number; month: number; type: string
  from_account_id: number | null; to_account_id: number | null
}

interface DebtAccount {
  id: number; account_id: number; principal: number; interest_rate: number
  term_months: number; amortization_months: number; payment_frequency: string
  extra_payment: number
}

interface SavingsContrib {
  id: number; account_id: number; amount: number; frequency: string
  start_month: number; end_month: number | null
}

type Tab = 'income' | 'expenses' | 'events' | 'debts' | 'savings'

export default function ScenarioDetail({ scenarioId, onBack }: { scenarioId: number; onBack: () => void }) {
  const { t } = useTranslation()
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tab, setTab] = useState<Tab>('income')

  const [incomes, setIncomes] = useState<IncomeStream[]>([])
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [events, setEvents] = useState<OneOffEvent[]>([])
  const [debts, setDebts] = useState<DebtAccount[]>([])
  const [savings, setSavings] = useState<SavingsContrib[]>([])

  const sid = scenarioId

  useEffect(() => {
    api.get<Scenario>(`/scenarios/${sid}`).then(setScenario)
    api.get<Account[]>('/accounts').then(setAccounts)
    refresh()
  }, [sid])

  const refresh = () => {
    api.get<IncomeStream[]>(`/forecast/${sid}/incomes`).then(setIncomes)
    api.get<RecurringExpense[]>(`/forecast/${sid}/expenses`).then(setExpenses)
    api.get<OneOffEvent[]>(`/forecast/${sid}/events`).then(setEvents)
    api.get<DebtAccount[]>(`/forecast/${sid}/debts`).then(setDebts)
    api.get<SavingsContrib[]>(`/forecast/${sid}/savings`).then(setSavings)
  }

  const accountName = (id: number | null) => accounts.find(a => a.id === id)?.name || '—'

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'income', label: 'Income', count: incomes.length },
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'events', label: 'Events', count: events.length },
    { key: 'debts', label: 'Debts', count: debts.length },
    { key: 'savings', label: 'Savings', count: savings.length },
  ]

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 mb-4">
        <ArrowLeft size={14} />
        Back to scenarios
      </button>

      <h1 className="text-xl font-semibold mb-6 flex items-center gap-3">
        {scenario && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scenario.color }} />}
        {scenario?.name}
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-surface-700">
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === tb.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-surface-400 hover:text-surface-200'
            }`}
          >
            {tb.label} <span className="text-xs text-surface-500 ml-1">({tb.count})</span>
          </button>
        ))}
      </div>

      {tab === 'income' && <IncomeTab sid={sid} incomes={incomes} accounts={accounts} onRefresh={refresh} />}
      {tab === 'expenses' && <ExpenseTab sid={sid} expenses={expenses} accounts={accounts} onRefresh={refresh} />}
      {tab === 'events' && <EventTab sid={sid} events={events} accounts={accounts} onRefresh={refresh} />}
      {tab === 'debts' && <DebtTab sid={sid} debts={debts} accounts={accounts} onRefresh={refresh} />}
      {tab === 'savings' && <SavingsTab sid={sid} savings={savings} accounts={accounts} onRefresh={refresh} />}
    </div>
  )
}

function IncomeTab({ sid, incomes, accounts, onRefresh }: { sid: number; incomes: IncomeStream[]; accounts: Account[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', amount: 0, frequency: 'monthly', income_type: 'employment', start_month: 0, account_id: '' })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    await api.post(`/forecast/${sid}/incomes`, { ...form, account_id: form.account_id ? Number(form.account_id) : null })
    setAdding(false)
    setForm({ name: '', amount: 0, frequency: 'monthly', income_type: 'employment', start_month: 0, account_id: '' })
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add income</button>
      </div>
      {adding && (
        <div className="card mb-4 grid grid-cols-6 gap-2">
          <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
          <input type="number" placeholder="Amount" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="input">
            <option value="monthly">Monthly</option><option value="biweekly">Biweekly</option><option value="annual">Annual</option><option value="one_time">One-time</option>
          </select>
          <select value={form.income_type} onChange={e => setForm({ ...form, income_type: e.target.value })} className="input">
            <option value="employment">Employment</option><option value="self_employment">Self-employment</option><option value="dividend_eligible">Eligible dividend</option>
            <option value="dividend_ineligible">Ineligible dividend</option><option value="interest">Interest</option><option value="capital_gain">Capital gain</option>
          </select>
          <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="input">
            <option value="">No account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={handleAdd} disabled={!form.name} className="btn-primary">Save</button>
        </div>
      )}
      <Table
        headers={['Name', 'Amount', 'Frequency', 'Type', 'Start Mo.', '']}
        rows={incomes.map(i => ({
          id: i.id,
          cells: [i.name, `$${i.amount.toLocaleString()}`, i.frequency, i.income_type, String(i.start_month)],
        }))}
        onDelete={async (id) => { await api.delete(`/forecast/${sid}/incomes/${id}`); onRefresh() }}
      />
    </div>
  )
}

function ExpenseTab({ sid, expenses, accounts, onRefresh }: { sid: number; expenses: RecurringExpense[]; accounts: Account[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', amount: 0, frequency: 'monthly', inflation_adjusted: true, start_month: 0, account_id: '' })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    await api.post(`/forecast/${sid}/expenses`, { ...form, account_id: form.account_id ? Number(form.account_id) : null })
    setAdding(false)
    setForm({ name: '', amount: 0, frequency: 'monthly', inflation_adjusted: true, start_month: 0, account_id: '' })
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add expense</button>
      </div>
      {adding && (
        <div className="card mb-4 grid grid-cols-5 gap-2">
          <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
          <input type="number" placeholder="Amount" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="input">
            <option value="monthly">Monthly</option><option value="biweekly">Biweekly</option><option value="annual">Annual</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.inflation_adjusted} onChange={e => setForm({ ...form, inflation_adjusted: e.target.checked })} className="accent-blue-500" /> Inflation adj.</label>
          <button onClick={handleAdd} disabled={!form.name} className="btn-primary">Save</button>
        </div>
      )}
      <Table
        headers={['Name', 'Amount', 'Frequency', 'Inflation Adj.', 'Start Mo.', '']}
        rows={expenses.map(e => ({
          id: e.id,
          cells: [e.name, `$${e.amount.toLocaleString()}`, e.frequency, e.inflation_adjusted ? 'Yes' : 'No', String(e.start_month)],
        }))}
        onDelete={async (id) => { await api.delete(`/forecast/${sid}/expenses/${id}`); onRefresh() }}
      />
    </div>
  )
}

function EventTab({ sid, events, accounts, onRefresh }: { sid: number; events: OneOffEvent[]; accounts: Account[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', amount: 0, month: 0, type: 'expense' })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    await api.post(`/forecast/${sid}/events`, form)
    setAdding(false)
    setForm({ name: '', amount: 0, month: 0, type: 'expense' })
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add event</button>
      </div>
      {adding && (
        <div className="card mb-4 grid grid-cols-5 gap-2">
          <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
          <input type="number" placeholder="Amount" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
          <input type="number" placeholder="Month (0-59)" value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })} className="input" />
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
            <option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option>
          </select>
          <button onClick={handleAdd} disabled={!form.name} className="btn-primary">Save</button>
        </div>
      )}
      <Table
        headers={['Name', 'Amount', 'Month', 'Type', '']}
        rows={events.map(e => ({
          id: e.id,
          cells: [e.name, `$${e.amount.toLocaleString()}`, String(e.month), e.type],
        }))}
        onDelete={async (id) => { await api.delete(`/forecast/${sid}/events/${id}`); onRefresh() }}
      />
    </div>
  )
}

function DebtTab({ sid, debts, accounts, onRefresh }: { sid: number; debts: DebtAccount[]; accounts: Account[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ account_id: '', principal: 0, interest_rate: 5, term_months: 60, amortization_months: 300, payment_frequency: 'monthly', extra_payment: 0 })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    await api.post(`/forecast/${sid}/debts`, { ...form, account_id: Number(form.account_id) })
    setAdding(false)
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add debt</button>
      </div>
      {adding && (
        <div className="card mb-4 grid grid-cols-4 gap-2">
          <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="input">
            <option value="">Select account...</option>{accounts.filter(a => !a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="number" placeholder="Principal" value={form.principal || ''} onChange={e => setForm({ ...form, principal: Number(e.target.value) })} className="input" />
          <input type="number" placeholder="Rate %" step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: Number(e.target.value) })} className="input" />
          <input type="number" placeholder="Amort. months" value={form.amortization_months} onChange={e => setForm({ ...form, amortization_months: Number(e.target.value) })} className="input" />
          <input type="number" placeholder="Term months" value={form.term_months} onChange={e => setForm({ ...form, term_months: Number(e.target.value) })} className="input" />
          <select value={form.payment_frequency} onChange={e => setForm({ ...form, payment_frequency: e.target.value })} className="input">
            <option value="monthly">Monthly</option><option value="biweekly">Biweekly</option><option value="accelerated_biweekly">Accelerated biweekly</option>
          </select>
          <input type="number" placeholder="Extra payment" value={form.extra_payment || ''} onChange={e => setForm({ ...form, extra_payment: Number(e.target.value) })} className="input" />
          <button onClick={handleAdd} disabled={!form.account_id} className="btn-primary">Save</button>
        </div>
      )}
      <Table
        headers={['Account', 'Principal', 'Rate', 'Amort.', 'Term', 'Frequency', '']}
        rows={debts.map(d => ({
          id: d.id,
          cells: [accounts.find(a => a.id === d.account_id)?.name || '—', `$${d.principal.toLocaleString()}`, `${d.interest_rate}%`, `${d.amortization_months}mo`, `${d.term_months}mo`, d.payment_frequency],
        }))}
        onDelete={async (id) => { await api.delete(`/forecast/${sid}/debts/${id}`); onRefresh() }}
      />
    </div>
  )
}

function SavingsTab({ sid, savings, accounts, onRefresh }: { sid: number; savings: SavingsContrib[]; accounts: Account[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ account_id: '', amount: 0, frequency: 'monthly', start_month: 0 })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    await api.post(`/forecast/${sid}/savings`, { ...form, account_id: Number(form.account_id) })
    setAdding(false)
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add contribution</button>
      </div>
      {adding && (
        <div className="card mb-4 grid grid-cols-4 gap-2">
          <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="input">
            <option value="">Select account...</option>{accounts.filter(a => a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="number" placeholder="Amount" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="input">
            <option value="monthly">Monthly</option><option value="biweekly">Biweekly</option><option value="annual">Annual</option>
          </select>
          <button onClick={handleAdd} disabled={!form.account_id} className="btn-primary">Save</button>
        </div>
      )}
      <Table
        headers={['Account', 'Amount', 'Frequency', 'Start Mo.', '']}
        rows={savings.map(s => ({
          id: s.id,
          cells: [accounts.find(a => a.id === s.account_id)?.name || '—', `$${s.amount.toLocaleString()}`, s.frequency, String(s.start_month)],
        }))}
        onDelete={async (id) => { await api.delete(`/forecast/${sid}/savings/${id}`); onRefresh() }}
      />
    </div>
  )
}

function Table({ headers, rows, onDelete }: { headers: string[]; rows: { id: number; cells: string[] }[]; onDelete: (id: number) => void }) {
  if (rows.length === 0) return <p className="text-surface-500 text-sm py-4">No items yet.</p>
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-surface-400 uppercase border-b border-surface-700">
        {headers.map(h => <th key={h} className="px-3 py-2">{h}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-surface-800">
        {rows.map(r => (
          <tr key={r.id} className="hover:bg-surface-800/50">
            {r.cells.map((c, i) => <td key={i} className="px-3 py-2 font-mono text-xs">{c}</td>)}
            <td className="px-3 py-2 text-right">
              <button onClick={() => onDelete(r.id)} className="text-surface-500 hover:text-red-400"><Trash2 size={13} /></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
