import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2, Target, CheckCircle } from 'lucide-react'
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

interface CreditCardDebt {
  id: number; account_id: number; balance: number; interest_rate: number
  monthly_payment: number; start_month: number
}

interface SavingsContrib {
  id: number; account_id: number; amount: number; frequency: string
  start_month: number; end_month: number | null; expected_return_rate: number | null
}

interface EmployerRRSPMatch {
  id: number
  income_stream_id: number
  rrsp_account_id: number
  label: string | null
  employee_rate: number
  employer_match_rate: number
  start_month: number
  end_month: number | null
}

interface Assumptions {
  inflation_rate: number
  salary_growth_rate: number
  investment_return_rate: number
  rrsp_room: number
  tfsa_room: number
  fhsa_room: number
}

type Tab = 'income' | 'expenses' | 'events' | 'debts' | 'savings' | 'retirement'

export default function ScenarioDetail({ scenarioId, onBack }: { scenarioId: number; onBack: () => void }) {
  const { t } = useTranslation()
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tab, setTab] = useState<Tab>('income')

  const [incomes, setIncomes] = useState<IncomeStream[]>([])
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [events, setEvents] = useState<OneOffEvent[]>([])
  const [debts, setDebts] = useState<DebtAccount[]>([])
  const [creditCards, setCreditCards] = useState<CreditCardDebt[]>([])
  const [savings, setSavings] = useState<SavingsContrib[]>([])
  const [employerRrsp, setEmployerRrsp] = useState<EmployerRRSPMatch[]>([])
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null)

  const sid = scenarioId

  useEffect(() => {
    api.get<Scenario>(`/scenarios/${sid}`).then(setScenario)
    api.get<Account[]>('/accounts').then(setAccounts)
    api.get<Assumptions>(`/forecast/${sid}/assumptions`).then(setAssumptions).catch(() => null)
    refresh()
  }, [sid])

  const refresh = () => {
    api.get<IncomeStream[]>(`/forecast/${sid}/incomes`).then(setIncomes)
    api.get<RecurringExpense[]>(`/forecast/${sid}/expenses`).then(setExpenses)
    api.get<OneOffEvent[]>(`/forecast/${sid}/events`).then(setEvents)
    api.get<DebtAccount[]>(`/forecast/${sid}/debts`).then(setDebts)
    api.get<CreditCardDebt[]>(`/forecast/${sid}/credit-cards`).then(setCreditCards)
    api.get<SavingsContrib[]>(`/forecast/${sid}/savings`).then(setSavings)
    api.get<EmployerRRSPMatch[]>(`/forecast/${sid}/employer-rrsp`).then(setEmployerRrsp)
  }

  const accountName = (id: number | null) => accounts.find(a => a.id === id)?.name || '—'

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'income', label: 'Income', count: incomes.length },
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'events', label: 'Events', count: events.length },
    { key: 'debts', label: 'Debts', count: debts.length + creditCards.length },
    { key: 'savings', label: 'Savings & Investments', count: savings.length + employerRrsp.length },
    { key: 'retirement', label: 'Retirement Planner' },
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
            {tb.label}
            {tb.count !== undefined && <span className="text-xs text-surface-500 ml-1">({tb.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'income' && <IncomeTab sid={sid} incomes={incomes} accounts={accounts} onRefresh={refresh} />}
      {tab === 'expenses' && <ExpenseTab sid={sid} expenses={expenses} accounts={accounts} onRefresh={refresh} />}
      {tab === 'events' && <EventTab sid={sid} events={events} accounts={accounts} onRefresh={refresh} />}
      {tab === 'debts' && <DebtTab sid={sid} debts={debts} creditCards={creditCards} accounts={accounts} onRefresh={refresh} />}
      {tab === 'savings' && <SavingsTab sid={sid} savings={savings} employerRrsp={employerRrsp} incomes={incomes} accounts={accounts} onRefresh={refresh} />}
      {tab === 'retirement' && <RetirementTab incomes={incomes} accounts={accounts} savings={savings} employerRrsp={employerRrsp} assumptions={assumptions} />}
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

function DebtTab({ sid, debts, creditCards, accounts, onRefresh }: { sid: number; debts: DebtAccount[]; creditCards: CreditCardDebt[]; accounts: Account[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ account_id: '', principal: 0, interest_rate: 5, term_months: 60, amortization_months: 300, payment_frequency: 'monthly', extra_payment: 0 })
  const [adding, setAdding] = useState(false)
  const [ccForm, setCcForm] = useState({ account_id: '', balance: 0, interest_rate: 19.99, monthly_payment: 0 })
  const [addingCc, setAddingCc] = useState(false)

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
        <div className="card mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Debt account</label>
              <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="input w-full">
                <option value="">Select account...</option>{accounts.filter(a => !a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Payment frequency</label>
              <select value={form.payment_frequency} onChange={e => setForm({ ...form, payment_frequency: e.target.value })} className="input w-full">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Biweekly</option>
                <option value="accelerated_biweekly">Accelerated biweekly</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Principal ($) — original loan amount</label>
              <input type="number" value={form.principal || ''} onChange={e => setForm({ ...form, principal: Number(e.target.value) })} className="input w-full" placeholder="e.g. 250000" />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Annual interest rate (%)</label>
              <input type="number" step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: Number(e.target.value) })} className="input w-full" placeholder="e.g. 5.25" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Amortization (months) — total payoff length</label>
              <input type="number" value={form.amortization_months} onChange={e => setForm({ ...form, amortization_months: Number(e.target.value) })} className="input w-full" placeholder="e.g. 300 = 25 yrs" />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Term (months) — until renewal</label>
              <input type="number" value={form.term_months} onChange={e => setForm({ ...form, term_months: Number(e.target.value) })} className="input w-full" placeholder="e.g. 60 = 5 yrs" />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Extra payment per period ($)</label>
              <input type="number" value={form.extra_payment || ''} onChange={e => setForm({ ...form, extra_payment: Number(e.target.value) })} className="input w-full" placeholder="0" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={!form.account_id} className="btn-primary w-full">Save debt</button>
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

      {/* ── Credit Cards ── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium">Credit Cards</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Revolving balance — interest compounds monthly on the remaining balance, fixed payment applied each month.
            </p>
          </div>
          <button onClick={() => setAddingCc(!addingCc)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add credit card</button>
        </div>
        {addingCc && (
          <div className="card mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Credit card account</label>
                <select value={ccForm.account_id} onChange={e => setCcForm({ ...ccForm, account_id: e.target.value })} className="input w-full">
                  <option value="">Select account...</option>
                  {accounts.filter(a => !a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Current balance owed ($)</label>
                <input type="number" value={ccForm.balance || ''} onChange={e => setCcForm({ ...ccForm, balance: Number(e.target.value) })} className="input w-full" placeholder="e.g. 3500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Annual interest rate (%) — typical 19.99%</label>
                <input type="number" step="0.01" value={ccForm.interest_rate} onChange={e => setCcForm({ ...ccForm, interest_rate: Number(e.target.value) })} className="input w-full" placeholder="19.99" />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Fixed monthly payment ($)</label>
                <input type="number" value={ccForm.monthly_payment || ''} onChange={e => setCcForm({ ...ccForm, monthly_payment: Number(e.target.value) })} className="input w-full" placeholder="e.g. 200" />
              </div>
            </div>
            <button
              onClick={async () => {
                await api.post(`/forecast/${sid}/credit-cards`, { ...ccForm, account_id: Number(ccForm.account_id) })
                setAddingCc(false)
                setCcForm({ account_id: '', balance: 0, interest_rate: 19.99, monthly_payment: 0 })
                onRefresh()
              }}
              disabled={!ccForm.account_id || !ccForm.monthly_payment}
              className="btn-primary w-full"
            >
              Save credit card
            </button>
          </div>
        )}
        <Table
          headers={['Account', 'Balance', 'Rate', 'Monthly Payment', '']}
          rows={creditCards.map(cc => ({
            id: cc.id,
            cells: [
              accounts.find(a => a.id === cc.account_id)?.name || '—',
              `$${cc.balance.toLocaleString()}`,
              `${cc.interest_rate}%`,
              `$${cc.monthly_payment.toLocaleString()}/mo`,
            ],
          }))}
          onDelete={async (id) => { await api.delete(`/forecast/${sid}/credit-cards/${id}`); onRefresh() }}
        />
      </div>
    </div>
  )
}

function SavingsTab({ sid, savings, employerRrsp, incomes, accounts, onRefresh }: {
  sid: number
  savings: SavingsContrib[]
  employerRrsp: EmployerRRSPMatch[]
  incomes: IncomeStream[]
  accounts: Account[]
  onRefresh: () => void
}) {
  const [form, setForm] = useState({ account_id: '', amount: 0, frequency: 'monthly', start_month: 0, expected_return_rate: '' })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    await api.post(`/forecast/${sid}/savings`, {
      ...form,
      account_id: Number(form.account_id),
      expected_return_rate: form.expected_return_rate ? Number(form.expected_return_rate) : null,
    })
    setAdding(false)
    setForm({ account_id: '', amount: 0, frequency: 'monthly', start_month: 0, expected_return_rate: '' })
    onRefresh()
  }

  const projectValue = (s: SavingsContrib) => {
    const rate = s.expected_return_rate
    if (rate === null || rate === undefined) return null
    const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1
    const months = 60 - s.start_month
    const endMonth = s.end_month !== null ? Math.min(s.end_month, 59) : 59
    const contribMonths = endMonth - s.start_month + 1
    let monthlyAmount = s.amount
    if (s.frequency === 'biweekly') monthlyAmount = s.amount * 26 / 12
    if (s.frequency === 'annual') monthlyAmount = s.amount / 12
    // FV of annuity: PMT × ((1+r)^n - 1) / r
    if (monthlyRate === 0) return monthlyAmount * contribMonths
    const fv = monthlyAmount * (Math.pow(1 + monthlyRate, contribMonths) - 1) / monthlyRate
    // Then compound the result for remaining months after contributions stop
    const remainingMonths = months - contribMonths
    return fv * Math.pow(1 + monthlyRate, Math.max(0, remainingMonths))
  }

  const acctName = (id: number) => accounts.find(a => a.id === id)?.name || '—'
  const incomeName = (id: number) => incomes.find(i => i.id === id)?.name || '—'

  const [erForm, setErForm] = useState({
    income_stream_id: '',
    rrsp_account_id: '',
    label: '',
    employee_rate: 7,
    employer_match_rate: 5,
  })
  const [addingEr, setAddingEr] = useState(false)

  const handleAddEr = async () => {
    await api.post(`/forecast/${sid}/employer-rrsp`, {
      income_stream_id: Number(erForm.income_stream_id),
      rrsp_account_id: Number(erForm.rrsp_account_id),
      employee_rate: erForm.employee_rate,
      employer_match_rate: erForm.employer_match_rate,
      label: erForm.label || null,
    })
    setAddingEr(false)
    setErForm({ income_stream_id: '', rrsp_account_id: '', label: '', employee_rate: 7, employer_match_rate: 5 })
    onRefresh()
  }

  // Preview monthly amounts for the employer RRSP form
  const erPreview = (() => {
    if (!erForm.income_stream_id) return null
    const inc = incomes.find(i => i.id === Number(erForm.income_stream_id))
    if (!inc) return null
    let monthly = inc.amount
    if (inc.frequency === 'biweekly') monthly = inc.amount * 26 / 12
    if (inc.frequency === 'annual') monthly = inc.amount / 12
    const emp = monthly * erForm.employee_rate / 100
    const er = monthly * erForm.employer_match_rate / 100
    return { monthly, emp, er, total: emp + er }
  })()

  const rrspAccounts = accounts.filter(a => a.type === 'rrsp' || a.name?.toLowerCase().includes('rrsp'))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-surface-500">
          Set an expected return rate per contribution to model compound growth in the forecast.
        </p>
        <button onClick={() => setAdding(!adding)} className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add contribution</button>
      </div>
      {adding && (
        <div className="card mb-4 grid grid-cols-5 gap-2">
          <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="input">
            <option value="">Select account...</option>{accounts.filter(a => a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="number" placeholder="Amount" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="input">
            <option value="monthly">Monthly</option><option value="biweekly">Biweekly</option><option value="annual">Annual</option>
          </select>
          <input type="number" placeholder="Return % (e.g. 7)" step="0.1" value={form.expected_return_rate} onChange={e => setForm({ ...form, expected_return_rate: e.target.value })} className="input" />
          <button onClick={handleAdd} disabled={!form.account_id} className="btn-primary">Save</button>
        </div>
      )}
      {savings.length === 0 ? (
        <p className="text-surface-500 text-sm py-4">No items yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-surface-400 uppercase border-b border-surface-700">
            <th className="px-3 py-2">Account</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Frequency</th>
            <th className="px-3 py-2">Return %</th>
            <th className="px-3 py-2">Projected (5yr)</th>
            <th className="px-3 py-2">Start Mo.</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-surface-800">
            {savings.map(s => {
              const proj = projectValue(s)
              const totalContrib = (() => {
                let mo = s.amount
                if (s.frequency === 'biweekly') mo = s.amount * 26 / 12
                if (s.frequency === 'annual') mo = s.amount / 12
                const months = (s.end_month !== null ? Math.min(s.end_month, 59) : 59) - s.start_month + 1
                return mo * months
              })()
              const growthPortion = proj !== null ? proj - totalContrib : null
              return (
                <tr key={s.id} className="hover:bg-surface-800/50">
                  <td className="px-3 py-2 font-mono text-xs">{acctName(s.account_id)}</td>
                  <td className="px-3 py-2 font-mono text-xs">${s.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.frequency}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.expected_return_rate !== null ? (
                      <span className="text-blue-400">{s.expected_return_rate}%</span>
                    ) : (
                      <span className="text-surface-500">default</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {proj !== null ? (
                      <div>
                        <span className="text-surface-200">${Math.round(proj).toLocaleString()}</span>
                        {growthPortion !== null && growthPortion > 0 && (
                          <span className="text-green-400 text-[10px] ml-1.5">
                            +${Math.round(growthPortion).toLocaleString()} interest
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.start_month}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={async () => { await api.delete(`/forecast/${sid}/savings/${s.id}`); onRefresh() }} className="text-surface-500 hover:text-red-400"><Trash2 size={13} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* ── Employer RRSP Match ── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-medium">Employer RRSP Match</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Employee contributions come out of your take-home pay. Employer match is free money. Both go into your RRSP and consume contribution room.
            </p>
          </div>
          {incomes.length > 0 && (
            <button onClick={() => setAddingEr(!addingEr)} className="btn-primary flex items-center gap-1.5 text-xs">
              <Plus size={12} /> Add match
            </button>
          )}
        </div>
        {incomes.length === 0 && (
          <p className="text-xs text-surface-500 italic mt-2">Add an income stream first before setting up an employer RRSP match.</p>
        )}
        {addingEr && (
          <div className="card my-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Income stream (your salary)</label>
                <select value={erForm.income_stream_id} onChange={e => setErForm({ ...erForm, income_stream_id: e.target.value })} className="input w-full">
                  <option value="">Select income stream...</option>
                  {incomes.map(i => <option key={i.id} value={i.id}>{i.name} (${i.amount.toLocaleString()}/{i.frequency})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">RRSP account to deposit into</label>
                <select value={erForm.rrsp_account_id} onChange={e => setErForm({ ...erForm, rrsp_account_id: e.target.value })} className="input w-full">
                  <option value="">Select RRSP account...</option>
                  {accounts.filter(a => a.is_asset).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Your contribution (% of gross pay)</label>
                <div className="relative">
                  <input type="number" step="0.5" min="0" max="100" value={erForm.employee_rate}
                    onChange={e => setErForm({ ...erForm, employee_rate: Number(e.target.value) })}
                    className="input w-full pr-8" placeholder="e.g. 7" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Employer match (% of gross pay)</label>
                <div className="relative">
                  <input type="number" step="0.5" min="0" max="100" value={erForm.employer_match_rate}
                    onChange={e => setErForm({ ...erForm, employer_match_rate: Number(e.target.value) })}
                    className="input w-full pr-8" placeholder="e.g. 5" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Label (optional)</label>
              <input value={erForm.label} onChange={e => setErForm({ ...erForm, label: e.target.value })} className="input w-full" placeholder="e.g. Company Group RRSP" />
            </div>
            {/* Live preview */}
            {erPreview && (
              <div className="bg-surface-800 rounded-lg p-3 text-xs space-y-1">
                <p className="text-surface-400 font-medium mb-1.5">Monthly breakdown preview</p>
                <div className="flex justify-between">
                  <span className="text-surface-400">Your gross income</span>
                  <span className="font-mono text-surface-200">${Math.round(erPreview.monthly).toLocaleString()}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Your contribution ({erForm.employee_rate}%)</span>
                  <span className="font-mono text-orange-400">−${Math.round(erPreview.emp).toLocaleString()}/mo from take-home</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Employer match ({erForm.employer_match_rate}%)</span>
                  <span className="font-mono text-green-400">+${Math.round(erPreview.er).toLocaleString()}/mo free</span>
                </div>
                <div className="flex justify-between border-t border-surface-700 pt-1 font-semibold">
                  <span className="text-surface-300">Total to RRSP</span>
                  <span className="font-mono text-blue-400">${Math.round(erPreview.total).toLocaleString()}/mo</span>
                </div>
              </div>
            )}
            <button onClick={handleAddEr} disabled={!erForm.income_stream_id || !erForm.rrsp_account_id} className="btn-primary w-full">
              Save employer RRSP match
            </button>
          </div>
        )}

        {employerRrsp.length === 0 ? (
          <p className="text-surface-500 text-sm py-4">No employer RRSP matches yet.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead><tr className="text-left text-xs text-surface-400 uppercase border-b border-surface-700">
              <th className="px-3 py-2">Income stream</th>
              <th className="px-3 py-2">RRSP account</th>
              <th className="px-3 py-2 text-right">You contribute</th>
              <th className="px-3 py-2 text-right">Employer adds</th>
              <th className="px-3 py-2 text-right">Monthly total</th>
              <th className="px-3 py-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-surface-800">
              {employerRrsp.map(er => {
                const inc = incomes.find(i => i.id === er.income_stream_id)
                let monthly = inc?.amount || 0
                if (inc?.frequency === 'biweekly') monthly = monthly * 26 / 12
                if (inc?.frequency === 'annual') monthly = monthly / 12
                const emp = monthly * er.employee_rate / 100
                const employer = monthly * er.employer_match_rate / 100
                return (
                  <tr key={er.id} className="hover:bg-surface-800/50">
                    <td className="px-3 py-2 font-mono text-xs">{incomeName(er.income_stream_id)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{acctName(er.rrsp_account_id)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-right">
                      <span className="text-orange-400">{er.employee_rate}%</span>
                      <span className="text-surface-500 ml-1">(${Math.round(emp).toLocaleString()}/mo)</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-right">
                      <span className="text-green-400">{er.employer_match_rate}%</span>
                      <span className="text-surface-500 ml-1">(${Math.round(employer).toLocaleString()}/mo)</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-right text-blue-400 font-semibold">
                      ${Math.round(emp + employer).toLocaleString()}/mo
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={async () => { await api.delete(`/forecast/${sid}/employer-rrsp/${er.id}`); onRefresh() }} className="text-surface-500 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Retirement Planner ───────────────────────────────────────────────────────

function RetirementTab({ incomes, accounts, savings, employerRrsp, assumptions }: {
  incomes: IncomeStream[]
  accounts: Account[]
  savings: SavingsContrib[]
  employerRrsp: EmployerRRSPMatch[]
  assumptions: Assumptions | null
}) {
  const [currentAge, setCurrentAge] = useState(30)
  const [retireAge, setRetireAge] = useState(65)
  const [replacementPct, setReplacementPct] = useState(70)
  const [swr, setSwr] = useState(4.0)

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
  const fmtBig = (n: number) => {
    const a = Math.abs(n)
    return a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${Math.round(a)}`
  }

  const INVEST = ['tfsa', 'rrsp', 'fhsa', 'non_registered', 'savings_hisa', 'crypto']
  const toMonthly = (inc: IncomeStream) => {
    if (inc.frequency === 'biweekly') return inc.amount * 26 / 12
    if (inc.frequency === 'annual') return inc.amount / 12
    return inc.amount
  }

  // ── Scenario-derived inputs ──────────────────────────────────────────────
  const primaryIncome = incomes
    .filter(i => i.frequency !== 'one_time')
    .sort((a, b) => toMonthly(b) - toMonthly(a))[0]

  const growthRate = (primaryIncome?.growth_rate ?? assumptions?.salary_growth_rate ?? 3) / 100
  const returnRate = (assumptions?.investment_return_rate ?? 6) / 100
  const rM = returnRate / 12

  const yrs = Math.max(0, retireAge - currentAge)
  const n = yrs * 12
  const baseMonthly = primaryIncome ? toMonthly(primaryIncome) : 0

  // ── Projections ──────────────────────────────────────────────────────────
  const forecastedAnnual = baseMonthly * Math.pow(1 + growthRate, yrs) * 12
  const targetAnnual = forecastedAnnual * (replacementPct / 100)
  const nestEgg = swr > 0 ? targetAnnual / (swr / 100) : 0

  const portfolio = accounts
    .filter(a => a.is_asset && INVEST.includes(a.type))
    .reduce((s, a) => s + a.current_balance, 0)

  const savingsMonthly = savings.reduce((s, c) => {
    if (c.frequency === 'monthly') return s + c.amount
    if (c.frequency === 'annual') return s + c.amount / 12
    if (c.frequency === 'biweekly') return s + c.amount * 26 / 12
    return s
  }, 0)

  const erMonthly = employerRrsp.reduce((s, er) => {
    const inc = incomes.find(i => i.id === er.income_stream_id)
    return inc ? s + toMonthly(inc) * (er.employee_rate + er.employer_match_rate) / 100 : s
  }, 0)

  const totalSavings = savingsMonthly + erMonthly
  const fvPortfolio = portfolio * Math.pow(1 + rM, n)
  const fvContribs = n > 0 && rM > 0
    ? totalSavings * (Math.pow(1 + rM, n) - 1) / rM
    : totalSavings * n
  const projected = fvPortfolio + fvContribs

  const fundedPct = nestEgg > 0 ? (projected / nestEgg) * 100 : 0
  const gap = nestEgg - projected
  const addlNeeded = gap > 0 && n > 0 && rM > 0
    ? gap * rM / (Math.pow(1 + rM, n) - 1)
    : Math.max(0, gap / Math.max(n, 1))

  // ── Sensitivity ──────────────────────────────────────────────────────────
  const sensAges = [-10, -5, 0, 5, 10]
    .map(d => retireAge + d)
    .filter(a => a > currentAge + 1 && a <= 85)

  const calcAge = (age: number) => {
    const y2 = Math.max(0, age - currentAge)
    const n2 = y2 * 12
    const fv1 = portfolio * Math.pow(1 + rM, n2)
    const fv2 = n2 > 0 && rM > 0 ? totalSavings * (Math.pow(1 + rM, n2) - 1) / rM : totalSavings * n2
    const p2 = fv1 + fv2
    const tgt = baseMonthly * Math.pow(1 + growthRate, y2) * 12 * (replacementPct / 100)
    const egg2 = swr > 0 ? tgt / (swr / 100) : 0
    const f2 = egg2 > 0 ? (p2 / egg2) * 100 : 0
    const g2 = egg2 - p2
    const add2 = g2 > 0 && n2 > 0 && rM > 0 ? g2 * rM / (Math.pow(1 + rM, n2) - 1) : 0
    return { proj: p2, egg: egg2, funded: f2, additional: Math.max(0, add2), targetAnnual: tgt }
  }

  // ── Contextual tips ───────────────────────────────────────────────────────
  const tips: { type: 'good' | 'warn' | 'info'; title: string; body: string }[] = []

  if (fundedPct >= 100) {
    const sustainYears = Math.round(projected / targetAnnual)
    tips.push({ type: 'good', title: "You're on track!", body: `Your projected portfolio could sustain ${sustainYears} years of retirement income at your ${replacementPct}% target. You may be able to retire earlier or increase your target spending.` })
  } else if (addlNeeded > 0) {
    tips.push({ type: 'warn', title: `Save an additional ${fmt(addlNeeded)}/month to close the gap`, body: `You have a ${fmtBig(gap)} funding shortfall. Adding ${fmt(addlNeeded)}/mo now compounds over ${yrs} years and closes the gap by age ${retireAge}.` })
  }

  const erFree = employerRrsp.reduce((s, er) => {
    const inc = incomes.find(i => i.id === er.income_stream_id)
    return inc ? s + toMonthly(inc) * er.employer_match_rate / 100 : s
  }, 0)
  if (erFree > 0) {
    tips.push({ type: 'good', title: `${fmt(erFree * 12)}/yr in free employer contributions`, body: `Your employer adds ${fmt(erFree)}/mo to your RRSP at no cost to you. Contributing enough to trigger the full match is one of the highest-return financial moves available.` })
  }

  if (assumptions?.tfsa_room && assumptions.tfsa_room > 0) {
    tips.push({ type: 'info', title: `${fmt(assumptions.tfsa_room)} in TFSA room available`, body: "TFSA withdrawals are completely tax-free in retirement and don't reduce OAS or GIS benefits. Prioritize TFSA for flexible spending — it's the most flexible retirement account." })
  }

  if (assumptions?.rrsp_room && assumptions.rrsp_room > 0) {
    tips.push({ type: 'info', title: `${fmt(assumptions.rrsp_room)} in RRSP room available`, body: 'RRSP contributions reduce your taxable income today and grow tax-sheltered. If your tax bracket is higher now than it will be in retirement, RRSP contributions offer strong tax deferral.' })
  }

  if (yrs >= 20) {
    const totalMultiple = Math.pow(1 + returnRate, yrs).toFixed(1)
    tips.push({ type: 'info', title: 'Time is your biggest advantage', body: `Over ${yrs} years, every dollar invested today becomes $${totalMultiple} — that's the power of compounding. Consistency and staying invested matters far more than timing the market.` })
  }

  if (yrs > 0 && yrs < 10 && fundedPct < 100) {
    tips.push({ type: 'warn', title: 'Short time horizon — consider sequence-of-returns risk', body: `With ${yrs} years to retirement, a market downturn near retirement can significantly impact your outcome. Gradually shifting to more conservative assets as you approach retirement is worth discussing with an advisor.` })
  }

  // ── UI state ──────────────────────────────────────────────────────────────
  const readinessColor = fundedPct >= 100 ? 'text-green-400' : fundedPct >= 75 ? 'text-amber-400' : 'text-red-400'
  const readinessBadge = fundedPct >= 100 ? 'bg-green-900/40 text-green-400' : fundedPct >= 75 ? 'bg-amber-900/40 text-amber-400' : 'bg-red-900/40 text-red-400'
  const readinessLabel = fundedPct >= 100 ? 'On Track' : fundedPct >= 75 ? 'Almost There' : 'Needs Attention'
  const progressColor = fundedPct >= 100 ? 'bg-green-500' : fundedPct >= 75 ? 'bg-amber-500' : 'bg-red-500'
  const tipBorder = { good: 'border-l-green-500', warn: 'border-l-amber-500', info: 'border-l-blue-500' }
  const tipTitle = { good: 'text-green-400', warn: 'text-amber-400', info: 'text-blue-400' }

  if (!primaryIncome) {
    return (
      <div className="card text-center py-16">
        <Target className="mx-auto text-surface-600 mb-3" size={36} />
        <p className="text-surface-400 font-medium mb-1">No income streams found</p>
        <p className="text-surface-500 text-sm">Add at least one income source in the Income tab to use the retirement planner.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Row 1: Sliders + Readiness ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Inputs panel */}
        <div className="card p-5 space-y-5">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest">Parameters</p>

          {([
            { label: 'Your current age', val: currentAge, set: setCurrentAge, min: 18, max: 75, step: 1, unit: '' as const, hint: '' },
            { label: 'Target retirement age', val: retireAge, set: setRetireAge, min: 45, max: 80, step: 1, unit: '' as const, hint: '' },
            { label: 'Income replacement', val: replacementPct, set: setReplacementPct, min: 40, max: 100, step: 5, unit: '%' as const, hint: '% of pre-retirement salary you want' },
            { label: 'Safe withdrawal rate', val: swr, set: setSwr, min: 2, max: 6, step: 0.5, unit: '%' as const, hint: '4% is the traditional benchmark' },
          ] as const).map(({ label, val, set, min, max, step, unit, hint }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-surface-400">{label}</span>
                <span className="font-mono font-bold text-surface-100">{val}{unit}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e => (set as (v: number) => void)(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer" />
              {hint && <p className="text-[10px] text-surface-500 mt-0.5">{hint}</p>}
            </div>
          ))}

          <div className="border-t border-surface-700 pt-4 space-y-1.5 text-xs">
            <p className="text-[10px] text-surface-500 uppercase tracking-wide font-medium mb-2">Pulled from scenario</p>
            {[
              { label: 'Base income', val: `${fmt(baseMonthly)}/mo` },
              { label: 'Income growth', val: `${(growthRate * 100).toFixed(1)}%/yr` },
              { label: 'Investment return', val: `${(returnRate * 100).toFixed(1)}%/yr` },
              { label: 'Monthly savings', val: `${fmt(totalSavings)}/mo` },
              { label: 'Current portfolio', val: fmt(portfolio) },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between">
                <span className="text-surface-500">{label}</span>
                <span className="font-mono text-surface-300">{val}</span>
              </div>
            ))}
            {erMonthly > 0 && (
              <div className="flex justify-between">
                <span className="text-surface-500">incl. employer RRSP</span>
                <span className="font-mono text-green-400">+{fmt(erMonthly)}/mo</span>
              </div>
            )}
          </div>
        </div>

        {/* Readiness + key numbers */}
        <div className="col-span-2 space-y-4">

          {/* Readiness hero */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-surface-400 uppercase tracking-widest">Retirement Readiness</p>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className={`text-5xl font-bold font-mono ${readinessColor}`}>
                    {Math.min(Math.round(fundedPct), 999)}%
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${readinessBadge}`}>
                    {readinessLabel}
                  </span>
                </div>
                <p className="text-xs text-surface-500 mt-2">
                  Projected {fmtBig(projected)} · Need {fmtBig(nestEgg)} · Retire at {retireAge} in {yrs} years
                </p>
              </div>
              <div className="shrink-0 text-right">
                {fundedPct >= 100 ? (
                  <div className="text-green-400 flex flex-col items-center gap-1">
                    <CheckCircle size={36} />
                    <p className="text-[10px]">Fully funded</p>
                  </div>
                ) : (
                  <div className="w-28">
                    <div className="w-full bg-surface-800 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                        style={{ width: `${Math.min(fundedPct, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-surface-500 text-center mt-1.5">{Math.round(fundedPct)}% funded</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3-col key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Nest Egg Needed</p>
              <p className="text-2xl font-bold font-mono">{fmtBig(nestEgg)}</p>
              <p className="text-[10px] text-surface-500 mt-1">{fmt(targetAnnual)}/yr at {swr}% SWR</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Projected at {retireAge}</p>
              <p className={`text-2xl font-bold font-mono ${projected >= nestEgg ? 'text-green-400' : 'text-amber-400'}`}>
                {fmtBig(projected)}
              </p>
              <p className="text-[10px] text-surface-500 mt-1">{(returnRate * 100).toFixed(0)}%/yr growth</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">{gap > 0 ? 'Funding Gap' : 'Surplus'}</p>
              <p className={`text-2xl font-bold font-mono ${gap <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {gap <= 0 ? `+${fmtBig(Math.abs(gap))}` : `-${fmtBig(gap)}`}
              </p>
              <p className="text-[10px] text-surface-500 mt-1">
                {gap > 0 ? `+${fmt(addlNeeded)}/mo to close` : 'you are fully funded'}
              </p>
            </div>
          </div>

          {/* Retirement income card */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3">
              Income projection at age {retireAge}
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-surface-500">Forecasted gross salary</span>
                <span className="font-mono text-surface-300">{fmt(forecastedAnnual)}/yr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Current portfolio grows to</span>
                <span className="font-mono text-surface-300">{fmtBig(fvPortfolio)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Target ({replacementPct}% replacement)</span>
                <span className="font-mono font-semibold text-surface-100">{fmt(targetAnnual)}/yr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Contributions grow to</span>
                <span className="font-mono text-surface-300">{fmtBig(fvContribs)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-surface-700 mt-0.5">
                <span className="text-surface-400 font-semibold">Monthly retirement income</span>
                <span className="font-mono font-bold text-blue-400 text-sm">{fmt(targetAnnual / 12)}/mo</span>
              </div>
              {addlNeeded > 0 && (
                <div className="flex justify-between pt-2 border-t border-surface-700 mt-0.5">
                  <span className="text-red-400 font-semibold">Additional needed now</span>
                  <span className="font-mono font-bold text-red-400">+{fmt(addlNeeded)}/mo</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tips ────────────────────────────────────────────────────────── */}
      {tips.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3">Insights & Tips</p>
          <div className="grid grid-cols-2 gap-3">
            {tips.slice(0, 4).map((tip, i) => (
              <div key={i} className={`card p-4 border-l-2 ${tipBorder[tip.type]}`}>
                <p className={`text-xs font-semibold mb-1.5 ${tipTitle[tip.type]}`}>{tip.title}</p>
                <p className="text-xs text-surface-400 leading-relaxed">{tip.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sensitivity table ───────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3">
          Retirement Age Sensitivity
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-surface-500 border-b border-surface-700">
                <th className="px-4 py-2.5 font-medium">Retire at</th>
                <th className="px-4 py-2.5 font-medium text-right">Years to go</th>
                <th className="px-4 py-2.5 font-medium text-right">Target income</th>
                <th className="px-4 py-2.5 font-medium text-right">Nest egg needed</th>
                <th className="px-4 py-2.5 font-medium text-right">Projected</th>
                <th className="px-4 py-2.5 font-medium text-right">Funded</th>
                <th className="px-4 py-2.5 font-medium text-right">Extra needed/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {sensAges.map(age => {
                const c = calcAge(age)
                const isSel = age === retireAge
                return (
                  <tr key={age}
                    className={`cursor-pointer transition-colors ${isSel ? 'bg-blue-900/20' : 'hover:bg-surface-800/40'}`}
                    onClick={() => setRetireAge(age)}>
                    <td className="px-4 py-2.5 font-semibold text-surface-200">
                      {age}
                      {isSel && <span className="ml-2 text-[10px] text-blue-400 font-normal">← selected</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-400">{Math.max(0, age - currentAge)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-300">{fmt(c.targetAnnual)}/yr</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-300">{fmtBig(c.egg)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-300">{fmtBig(c.proj)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${c.funded >= 100 ? 'text-green-400' : c.funded >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                      {Math.round(c.funded)}%
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${c.additional <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {c.additional <= 0 ? '✓ on track' : `+${fmt(c.additional)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-surface-500 mt-1.5">Click any row to select that retirement age</p>
      </div>
    </div>
  )
}

// ─── Generic Table ─────────────────────────────────────────────────────────────

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
