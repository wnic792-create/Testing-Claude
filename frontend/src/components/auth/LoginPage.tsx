import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wallet, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'

const API_BASE = '/api'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore(s => s.login)

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => setBackendOk(d.status === 'ok'))
      .catch(() => setBackendOk(false))
  }, [])

  const wasRedirected = location.state?.from?.pathname && location.state.from.pathname !== '/login'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login'
      const body = isRegister
        ? { username, email, password }
        : { username, password }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Request failed' }))
        throw new Error(data.detail || `Error ${res.status}`)
      }

      const data = await res.json()

      if (!data.access_token) {
        throw new Error('No token in response')
      }

      login(data.access_token, data.user_id, data.username)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
            <Wallet size={28} className="text-surface-950" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Finance</h1>
          <p className="text-sm text-surface-500 mt-2">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-7">
          {/* Backend status */}
          {backendOk === false && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-negative/10 border border-negative/20 text-negative text-sm">
              Backend is not reachable. Make sure the server is running on port 8000.
            </div>
          )}

          {wasRedirected && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              You were redirected back from the app. Your session may have expired.
            </div>
          )}

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-negative/10 border border-negative/20 text-negative text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[12px] text-surface-400 font-medium mb-2 block">
                Username
              </label>
              <input
                className="input w-full"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                required
                minLength={3}
              />
            </div>

            {isRegister && (
              <div>
                <label className="text-[12px] text-surface-400 font-medium mb-2 block">
                  Email
                </label>
                <input
                  className="input w-full"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-[12px] text-surface-400 font-medium mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  className="input w-full pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Min. 8 characters' : 'Your password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={isRegister ? 8 : 1}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || backendOk === false}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-800 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError('') }}
              className="text-sm text-surface-400 hover:text-white transition-colors"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
