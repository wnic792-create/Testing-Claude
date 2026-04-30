import { useTranslation } from 'react-i18next'
import { LineChart } from 'lucide-react'

export default function InvestmentPage() {
  const { t } = useTranslation()
  return (
    <div className="p-6 lg:p-8 max-w-[1440px]">
      <h1 className="text-2xl font-bold tracking-tight mb-6">{t('nav.investments')}</h1>
      <div className="card p-12 text-center">
        <LineChart className="mx-auto text-surface-600 mb-4" size={48} />
        <p className="text-surface-300 font-medium mb-2">Investment Portfolio</p>
        <p className="text-surface-500 text-sm">Coming soon — holdings, fund look-through, and allocation charts.</p>
      </div>
    </div>
  )
}
