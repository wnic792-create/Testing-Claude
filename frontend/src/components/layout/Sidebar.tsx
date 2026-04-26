import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PiggyBank,
  TrendingUp,
  GitBranch,
  Target,
  SlidersHorizontal,
  Tags,
  Scale,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'
import { useThemeStore } from '../../stores/theme'

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/accounts', icon: Wallet, labelKey: 'nav.accounts' },
  { path: '/transactions', icon: ArrowLeftRight, labelKey: 'nav.transactions' },
  { path: '/budget', icon: PiggyBank, labelKey: 'nav.budget' },
  { path: '/forecast', icon: TrendingUp, labelKey: 'nav.forecast' },
  { path: '/scenarios', icon: GitBranch, labelKey: 'nav.scenarios' },
  { path: '/goals', icon: Target, labelKey: 'nav.goals' },
  { path: '/assumptions', icon: SlidersHorizontal, labelKey: 'nav.assumptions' },
  { path: '/categories', icon: Tags, labelKey: 'nav.categories' },
  { path: '/reconciliation', icon: Scale, labelKey: 'nav.reconciliation' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const { isDark, toggle } = useThemeStore()

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'fr' : 'en')
  }

  return (
    <aside className="w-52 bg-surface-900 border-r border-surface-700 flex flex-col h-full shrink-0">
      <div className="px-4 py-4 border-b border-surface-700">
        <h1 className="text-base font-bold tracking-tight text-surface-100">
          Local Finance
        </h1>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, labelKey }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-surface-800 text-blue-400 border-r-2 border-blue-400'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`
            }
          >
            <Icon size={16} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-700 p-3 flex gap-2">
        <button
          onClick={toggle}
          className="flex-1 flex items-center justify-center gap-2 text-xs text-surface-400 hover:text-surface-200 py-1.5 rounded hover:bg-surface-800 transition-colors"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {isDark ? 'Light' : 'Dark'}
        </button>
        <button
          onClick={toggleLang}
          className="flex-1 text-xs text-surface-400 hover:text-surface-200 py-1.5 rounded hover:bg-surface-800 transition-colors font-medium"
        >
          {i18n.language === 'en' ? 'FR' : 'EN'}
        </button>
      </div>
    </aside>
  )
}
