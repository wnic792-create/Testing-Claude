import { useTranslation } from 'react-i18next'

export default function Dashboard() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.netWorth')}</p>
          <p className="text-2xl font-bold mt-1 font-mono">--</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.monthlyIncome')}</p>
          <p className="text-2xl font-bold mt-1 font-mono text-green-400">--</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.monthlyExpenses')}</p>
          <p className="text-2xl font-bold mt-1 font-mono text-red-400">--</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400 uppercase tracking-wide">{t('dashboard.savingsRate')}</p>
          <p className="text-2xl font-bold mt-1 font-mono text-blue-400">--</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card h-64 flex items-center justify-center">
          <p className="text-surface-500 text-sm">{t('dashboard.netWorthChart')}</p>
        </div>
        <div className="card h-64 flex items-center justify-center">
          <p className="text-surface-500 text-sm">{t('dashboard.cashFlowChart')}</p>
        </div>
      </div>
    </div>
  )
}
