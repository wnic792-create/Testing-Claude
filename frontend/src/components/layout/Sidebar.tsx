import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
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
  Repeat,
  Users,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useThemeStore } from '../../stores/theme'
import { useProfileStore } from '../../stores/profile'

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
  { path: '/recurring', icon: Repeat, labelKey: 'nav.recurring' },
  { path: '/profiles', icon: Users, labelKey: 'nav.profiles' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const { isDark, toggle } = useThemeStore()
  const { profiles, activeProfileId, setActiveProfileId } = useProfileStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'fr' : 'en')
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeProfile = activeProfileId === 'all'
    ? null
    : profiles.find(p => p.id === activeProfileId)

  return (
    <aside className="w-52 bg-surface-900 border-r border-surface-700 flex flex-col h-full shrink-0">
      <div className="px-4 py-4 border-b border-surface-700">
        <h1 className="text-base font-bold tracking-tight text-surface-100">
          Local Finance
        </h1>
      </div>

      {/* Profile switcher */}
      {profiles.length > 0 && (
        <div className="px-3 py-2 border-b border-surface-700" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors text-left"
          >
            {activeProfile ? (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: activeProfile.color }}
              >
                {activeProfile.avatar_initial}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white shrink-0">
                <Users size={12} />
              </div>
            )}
            <span className="text-xs font-medium text-surface-200 truncate flex-1">
              {activeProfile ? activeProfile.name : 'Combined'}
            </span>
            <ChevronDown size={12} className={`text-surface-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="mt-1 bg-surface-800 rounded-lg border border-surface-700 shadow-lg overflow-hidden">
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProfileId(p.id); setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-700 transition-colors text-left"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: p.color }}
                  >
                    {p.avatar_initial}
                  </div>
                  <span className="text-surface-200 truncate flex-1">{p.name}</span>
                  {activeProfileId === p.id && <Check size={12} className="text-blue-400 shrink-0" />}
                </button>
              ))}
              <div className="border-t border-surface-700">
                <button
                  onClick={() => { setActiveProfileId('all'); setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-700 transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white shrink-0">
                    <Users size={10} />
                  </div>
                  <span className="text-surface-200 flex-1">Combined</span>
                  {activeProfileId === 'all' && <Check size={12} className="text-purple-400 shrink-0" />}
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/profiles') }}
                  className="w-full text-left px-3 py-2 text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
                >
                  Manage profiles…
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
