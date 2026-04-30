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
  ChevronDown,
  Check,
  LineChart,
  LogOut,
} from 'lucide-react'
import { useThemeStore } from '../../stores/theme'
import { useProfileStore } from '../../stores/profile'
import { useAuthStore } from '../../stores/auth'

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
      { path: '/investments', icon: LineChart, labelKey: 'nav.investments' },
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
  const { profiles, activeProfileId, setActiveProfileId } = useProfileStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { username, logout } = useAuthStore()

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
    <aside className="w-60 bg-surface-950 border-r border-surface-800 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <Wallet size={18} className="text-surface-950" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-white">Finance</h1>
            <p className="text-[11px] text-surface-500">Personal Tracker</p>
          </div>
        </div>
      </div>

      {/* Profile switcher */}
      {profiles.length > 0 && (
        <div className="px-4 pb-4" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-900 hover:bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all duration-200 text-left"
          >
            {activeProfile ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: activeProfile.color }}
              >
                {activeProfile.avatar_initial}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-700 text-white shrink-0">
                <Users size={14} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate block">
                {activeProfile ? activeProfile.name : 'Combined'}
              </span>
              <span className="text-[11px] text-surface-500">
                {activeProfile ? 'Personal' : 'All profiles'}
              </span>
            </div>
            <ChevronDown size={14} className={`text-surface-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="mt-2 bg-surface-900 rounded-xl border border-surface-700/60 shadow-2xl shadow-black/40 overflow-hidden absolute z-50 w-[calc(100%-2rem)]">
              <div className="p-1.5">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setActiveProfileId(p.id); setDropdownOpen(false) }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 text-left ${
                      activeProfileId === p.id
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-surface-800 text-surface-300'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: p.color }}
                    >
                      {p.avatar_initial}
                    </div>
                    <span className="truncate flex-1">{p.name}</span>
                    {activeProfileId === p.id && <Check size={14} className="text-accent shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-surface-800 p-1.5">
                <button
                  onClick={() => { setActiveProfileId('all'); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 text-left ${
                    activeProfileId === 'all'
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-surface-800 text-surface-300'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-surface-700 text-white shrink-0">
                    <Users size={12} />
                  </div>
                  <span className="flex-1">Combined</span>
                  {activeProfileId === 'all' && <Check size={14} className="text-accent shrink-0" />}
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/profiles') }}
                  className="w-full text-left px-3 py-2.5 text-sm text-surface-500 hover:text-surface-300 rounded-lg hover:bg-surface-800 transition-all duration-150"
                >
                  Manage profiles...
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pb-3">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-6' : ''}>
            {section.label && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-500">
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
                    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-surface-400 hover:text-white hover:bg-white/[0.04]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className={isActive ? 'text-accent' : ''} />
                      <span>{t(labelKey)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-800 p-4 space-y-3">
        {username && (
          <div className="flex items-center justify-between px-3">
            <span className="text-[12px] text-surface-400 truncate">{username}</span>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="text-surface-500 hover:text-negative transition-colors p-1.5 rounded-lg hover:bg-surface-800"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
        <button
          onClick={toggleLang}
          className="w-full text-[12px] text-surface-500 hover:text-surface-300 py-2 rounded-xl hover:bg-surface-800 transition-all duration-200 font-semibold"
        >
          {i18n.language === 'en' ? 'Francais' : 'English'}
        </button>
      </div>
    </aside>
  )
}
