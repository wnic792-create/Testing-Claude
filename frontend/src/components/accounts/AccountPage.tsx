import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import type { Account } from '../../api/types'
import { useProfileStore } from '../../stores/profile'

const ACCOUNT_TYPES = [
  { value: 'chequing', label: 'Chequing' },
  { value: 'savings_hisa', label: 'Savings (HISA)' },
  { value: 'tfsa', label: 'TFSA / CELI' },
  { value: 'rrsp', label: 'RRSP / REER' },
  { value: 'fhsa', label: 'FHSA / CELIAPP' },
  { value: 'non_registered', label: 'Non-Registered' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loc', label: 'Line of Credit' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'car_loan', label: 'Car Loan' },
]

const DEBT_TYPES = ['credit_card', 'loc', 'mortgage', 'student_loan', 'car_loan']

export default function AccountPage() {
  const { t, i18n } = useTranslation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'chequing', currency: 'CAD', institution: '', current_balance: 0 })
  const { activeProfileId, profiles } = useProfileStore()

  const fetchAccounts = async () => {
    const data = await api.get<Account[]>('/accounts')
    setAccounts(data)
  }

  useEffect(() => { fetchAccounts() }, [activeProfileId])

  const handleCreate = async () => {
    const isDebt = DEBT_TYPES.includes(form.type)
    await api.post('/accounts', {
      ...form,
      profile_id: activeProfileId === 'all' ? 1 : activeProfileId,
      is_asset: !isDebt,
      current_balance: isDebt ? -Math.abs(form.current_balance) : form.current_balance,
    })
    setForm({ name: '', type: 'chequing', currency: 'CAD', institution: '', current_balance: 0 })
    setShowForm(false)
    fetchAccounts()
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/accounts/${id}`)
    fetchAccounts()
  }

  const handleRecalculate = async (account: Account) => {
    const msg =
      `Reset "${account.name}" balance = opening + sum(transactions)?\n\n` +
      `Enter the opening balance (what the account had before any transactions ` +
      `were imported). Leave at 0 if the transactions already include every ` +
      `movement that defines the balance.`
    const input = prompt(msg, '0')
    if (input === null) return
    const opening = Number(input)
    if (Number.isNaN(opening)) {
      alert('Invalid number.')
      return
    }
    await api.post(`/accounts/${account.id}/recalculate`, { opening_balance: opening })
    fetchAccounts()
  }

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency', currency,
    }).format(amount)

  const totalAssets = accounts.filter(a => a.is_asset).reduce((s, a) => s + a.current_balance, 0)
  const totalLiabilities = accounts.filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(a.current_balance), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('nav.accounts')}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          {t('common.add')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">Assets</p>
          <p className="text-xl font-bold font-mono text-green-400 mt-1">{formatAmount(totalAssets, 'CAD')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">Liabilities</p>
          <p className="text-xl font-bold font-mono text-red-400 mt-1">{formatAmount(totalLiabilities, 'CAD')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase">{t('dashboard.netWorth')}</p>
          <p className="text-xl font-bold font-mono mt-1">{formatAmount(totalAssets - totalLiabilities, 'CAD')}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6">
          <div className="grid grid-cols-5 gap-3">
            <input
              placeholder="Account name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input"
            />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
              {ACCOUNT_TYPES.map(at => (
                <option key={at.value} value={at.value}>{at.label}</option>
              ))}
            </select>
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="input">
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
            <input
              placeholder="Institution"
              value={form.institution}
              onChange={e => setForm({ ...form, institution: e.target.value })}
              className="input"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Balance"
                value={form.current_balance || ''}
                onChange={e => setForm({ ...form, current_balance: Number(e.target.value) })}
                className="input flex-1"
              />
              <button onClick={handleCreate} disabled={!form.name} className="btn-primary">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Account list */}
      <div className="space-y-2">
        {accounts.length === 0 ? (
          <p className="text-surface-500 text-sm">{t('common.noData')}</p>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="card flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-sm">{account.name}</p>
                <p className="text-xs text-surface-400">
                  {ACCOUNT_TYPES.find(at => at.value === account.type)?.label || account.type}
                  {account.institution && ` · ${account.institution}`}
                  {activeProfileId === 'all' && (() => {
                    const p = profiles.find(pr => pr.id === account.profile_id)
                    return p ? (
                      <span className="ml-1.5 inline-flex items-center gap-1">
                        · <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                        <span>{p.name}</span>
                      </span>
                    ) : null
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-mono text-sm ${account.current_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(account.current_balance, account.currency)}
                </span>
                <button
                  onClick={() => handleRecalculate(account)}
                  className="text-surface-500 hover:text-blue-400"
                  title="Recalculate balance from transactions"
                >
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => handleDelete(account.id)} className="text-surface-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
