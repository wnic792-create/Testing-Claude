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

const NAV_SECTIONS = [
  {
    items: [
      { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    ],
  },
  {
    label: 'Money',
    items: [
      { path: '/accounts', icon: Wallet, labelKey: 'nav.accounts' },
      { path: '/transactions', icon: ArrowLeftRight, labelKey: 'nav.transactions' },
      { path: '/recurring', icon: Repeat, labelKey: 'nav.recurring' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { path: '/budget', icon: PiggyBank, labelKey: 'nav.budget' },
      { path: '/forecast', icon: TrendingUp, labelKey: 'nav.forecast' },
      { path: '/scenarios', icon: GitBranch, labelKey: 'nav.scenarios' },
      { path: '/goals', icon: Target, labelKey: 'nav.goals' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { path: '/assumptions', icon: SlidersHorizontal, labelKey: 'nav.assumptions' },
      { path: '/categories', icon: Tags, labelKey: 'nav.categories' },
      { path: '/reconciliation', icon: Scale, labelKey: 'nav.reconciliation' },
      { path: '/profiles', icon: Users, labelKey: 'nav.profiles' },
      { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
    ],
  },
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
    <aside className="w-56 bg-gradient-to-b from-surface-900 via-surface-900 to-surface-950 border-r border-surface-800/80 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Wallet size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-surface-100">Local Finance</h1>
            <p className="text-[10px] text-surface-500 font-medium">Personal Tracker</p>
          </div>
        </div>
      </div>

      {/* Profile switcher */}
      {profiles.length > 0 && (
        <div className="px-3 pb-3" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-surface-800/50 hover:bg-surface-800/80 border border-surface-700/40 hover:border-surface-600/50 transition-all duration-200 text-left"
          >
            {activeProfile ? (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${activeProfile.color}, ${activeProfile.color}dd)` }}
              >
                {activeProfile.avatar_initial}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white shrink-0 shadow-sm">
                <Users size={13} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-surface-200 truncate block">
                {activeProfile ? activeProfile.name : 'Combined'}
              </span>
              <span className="text-[10px] text-surface-500">
                {activeProfile ? 'Personal' : 'All profiles'}
              </span>
            </div>
            <ChevronDown size={13} className={`text-surface-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="mt-1.5 bg-surface-800/95 backdrop-blur-md rounded-xl border border-surface-700/60 shadow-xl shadow-black/30 overflow-hidden absolute z-50 w-[calc(100%-1.5rem)]">
              <div className="p-1.5">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setActiveProfileId(p.id); setDropdownOpen(false) }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-all duration-150 text-left ${
                      activeProfileId === p.id
                        ? 'bg-blue-500/10 text-blue-300'
                        : 'hover:bg-surface-700/60 text-surface-300'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ background: p.color }}
                    >
                      {p.avatar_initial}
                    </div>
                    <span className="truncate flex-1">{p.name}</span>
                    {activeProfileId === p.id && <Check size={13} className="text-blue-400 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-surface-700/50 p-1.5">
                <button
                  onClick={() => { setActiveProfileId('all'); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-all duration-150 text-left ${
                    activeProfileId === 'all'
                      ? 'bg-purple-500/10 text-purple-300'
                      : 'hover:bg-surface-700/60 text-surface-300'
                  }`}
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white shrink-0">
                    <Users size={11} />
                  </div>
                  <span className="flex-1">Combined</span>
                  {activeProfileId === 'all' && <Check size={13} className="text-purple-400 shrink-0" />}
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/profiles') }}
                  className="w-full text-left px-2.5 py-2 text-xs text-surface-500 hover:text-surface-300 rounded-lg hover:bg-surface-700/60 transition-all duration-150"
                >
                  Manage profiles…
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-5' : ''}>
            {section.label && (
              <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-surface-500/80">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ path, icon: Icon, labelKey }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-400 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]'
                        : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-surface-500 group-hover:text-surface-400'}`}>
                        <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />
                      </div>
                      <span>{t(labelKey)}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-800/60 p-3 flex gap-1.5">
        <button
          onClick={toggle}
          className="flex-1 flex items-center justify-center gap-2 text-[11px] text-surface-500 hover:text-surface-300 py-2 rounded-lg hover:bg-surface-800/60 transition-all duration-200"
        >
          {isDark ? <Sun size={13} /> : <Moon size={13} />}
          {isDark ? 'Light' : 'Dark'}
        </button>
        <div className="w-px bg-surface-800" />
        <button
          onClick={toggleLang}
          className="flex-1 text-[11px] text-surface-500 hover:text-surface-300 py-2 rounded-lg hover:bg-surface-800/60 transition-all duration-200 font-semibold"
        >
          {i18n.language === 'en' ? 'FR' : 'EN'}
        </button>
      </div>
    </aside>
  )
}
