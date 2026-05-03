import { create } from 'zustand'

interface AuthState {
  token: string | null
  userId: number | null
  username: string | null
  isAuthenticated: boolean
  loginAt: number
  login: (token: string, userId: number, username: string) => void
  logout: () => void
  loadFromStorage: () => void
}

function getInitialState() {
  const token = localStorage.getItem('auth_token')
  const userId = localStorage.getItem('auth_user_id')
  const username = localStorage.getItem('auth_username')
  if (token && userId && username) {
    return { token, userId: Number(userId), username, isAuthenticated: true, loginAt: 0 }
  }
  return { token: null, userId: null, username: null, isAuthenticated: false, loginAt: 0 }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  login: (token, userId, username) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user_id', String(userId))
    localStorage.setItem('auth_username', username)
    set({ token, userId, username, isAuthenticated: true, loginAt: Date.now() })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user_id')
    localStorage.removeItem('auth_username')
    set({ token: null, userId: null, username: null, isAuthenticated: false, loginAt: 0 })
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('auth_token')
    const userId = localStorage.getItem('auth_user_id')
    const username = localStorage.getItem('auth_username')
    if (token && userId && username) {
      set({ token, userId: Number(userId), username, isAuthenticated: true })
    }
  },
}))
