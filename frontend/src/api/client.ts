import { useAuthStore } from '../stores/auth'

const API_BASE = '/api'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: optHeaders, ...restOptions } = options ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(optHeaders as Record<string, string> ?? {}),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...restOptions, headers })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Session expired')
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

let _getActiveProfileId: (() => number | 'all') | null = null

export function registerProfileGetter(fn: () => number | 'all') {
  _getActiveProfileId = fn
}

function withProfileId(path: string): string {
  if (!_getActiveProfileId) return path
  const id = _getActiveProfileId()
  if (id === 'all') return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}profile_id=${id}`
}

export const api = {
  get: <T>(path: string) => request<T>(withProfileId(path)),
  getRaw: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: formData,
      headers: { ...getAuthHeaders() },
    })
    if (res.status === 401) {
      useAuthStore.getState().logout()
      throw new Error('Session expired')
    }
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },
}
