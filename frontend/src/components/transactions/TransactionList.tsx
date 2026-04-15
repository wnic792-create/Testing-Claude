import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import type { Transaction, Account, Category } from '../../api/types'
import CategoryCombobox from './CategoryCombobox'

const PAGE_SIZE = 50

export default function TransactionList() {
  const { t, i18n } = useTranslation()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (accountFilter) params.set('account_id', accountFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(page * PAGE_SIZE))

    const txs = await api.get<Transaction[]>(`/transactions?${params}`)
    setTransactions(txs)
    setLoading(false)
  }, [search, accountFilter, dateFrom, dateTo, page])

  const fetchCategories = useCallback(() => {
    return api.get<Category[]>('/categories/flat').then(setCategories)
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts)
    fetchCategories()
  }, [fetchCategories])

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  const getCategoryName = (catId: number | null) => {
    if (!catId) return '—'
    const cat = categoryMap[catId]
    if (!cat) return '—'
    return i18n.language === 'fr' && cat.name_fr ? cat.name_fr : cat.name
  }

  const handleCategoryChange = async (txId: number, categoryId: number | null) => {
    const result = await api.patch<{ _learn?: { also_categorized: number } }>(
      `/transactions/${txId}`,
      { category_id: categoryId },
    )
    // If the backend auto-applied this category to other similar uncategorized
    // transactions, briefly toast the count.
    const also = result?._learn?.also_categorized || 0
    if (also > 0) {
      // Non-blocking notification
      setToast(`Also categorized ${also} similar transaction${also === 1 ? '' : 's'}.`)
      setTimeout(() => setToast(null), 2500)
    }
    fetchTransactions()
  }

  const handleCreateCategory = async (name: string): Promise<Category> => {
    const created = await api.post<Category>('/categories', {
      name,
      type: 'expense',
    })
    await fetchCategories()
    return created
  }

  const handleDelete = async (txId: number) => {
    if (!confirm(t('transactions.confirmDelete') || 'Delete this transaction?')) return
    await api.delete(`/transactions/${txId}`)
    fetchTransactions()
  }

  const handleDeleteAll = async () => {
    const hasFilter = search || accountFilter || dateFrom || dateTo
    const msg = hasFilter
      ? `Delete ALL transactions matching the current filters? This cannot be undone.`
      : `Delete ALL transactions in the database? This cannot be undone.`
    if (!confirm(msg)) return
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (accountFilter) params.set('account_id', accountFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const res = await fetch(`/api/transactions/bulk?${params}`, { method: 'DELETE' })
    const result = res.ok ? await res.json() : null
    alert(`Deleted ${result?.deleted ?? '?'} transactions.`)
    fetchTransactions()
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-CA' : 'en-CA', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700 bg-surface-900/50 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-surface-500" />
          <input
            type="text"
            placeholder={t('common.search') || 'Search...'}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="input pl-8 w-56"
          />
        </div>
        <select
          value={accountFilter}
          onChange={e => { setAccountFilter(e.target.value); setPage(0) }}
          className="input w-44"
        >
          <option value="">All accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(0) }}
          className="input w-36"
        />
        <span className="text-surface-500 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(0) }}
          className="input w-36"
        />
        <button
          onClick={handleDeleteAll}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-red-400 border border-red-900 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 size={12} />
          Delete all filtered
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 sticky top-0">
            <tr className="text-left text-xs text-surface-400 uppercase tracking-wider">
              <th className="px-4 py-2 w-28">Date</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 w-36">Account</th>
              <th className="px-4 py-2 w-44">Category</th>
              <th className="px-4 py-2 w-28 text-right">Amount</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-500">{t('common.loading')}</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-500">{t('common.noData')}</td></tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="px-4 py-1.5 font-mono text-xs text-surface-400">{tx.date}</td>
                  <td className="px-4 py-1.5 truncate max-w-xs" title={tx.description}>{tx.description}</td>
                  <td className="px-4 py-1.5 text-xs text-surface-400">{accountMap[tx.account_id]?.name || '—'}</td>
                  <td className="px-4 py-1.5">
                    <CategoryCombobox
                      value={tx.category_id}
                      categories={categories}
                      language={i18n.language}
                      onChange={cid => handleCategoryChange(tx.id, cid)}
                      onCreateCategory={handleCreateCategory}
                    />
                  </td>
                  <td className={`px-4 py-1.5 text-right font-mono text-xs ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAmount(tx.amount, tx.currency)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="text-surface-500 hover:text-red-400 p-1"
                      title={t('common.delete') || 'Delete'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-surface-700 bg-surface-900/50 text-xs text-surface-400">
        <span>{transactions.length} transactions</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 hover:bg-surface-700 rounded disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span>Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={transactions.length < PAGE_SIZE}
            className="p-1 hover:bg-surface-700 rounded disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-900/90 border border-green-700 text-green-100 text-sm rounded px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
