import { create } from 'zustand'
import { api, registerProfileGetter } from '../api/client'

export interface Profile {
  id: number
  name: string
  color: string
  avatar_initial: string
  created_at: string
}

interface ProfileState {
  profiles: Profile[]
  activeProfileId: number | 'all'
  setActiveProfileId: (id: number | 'all') => void
  fetchProfiles: () => Promise<void>
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfileId: 'all',
  setActiveProfileId: (id) => set({ activeProfileId: id }),
  fetchProfiles: async () => {
    try {
      const profiles = await api.getRaw<Profile[]>('/profiles')
      set((state) => {
        const ids = profiles.map(p => p.id)
        const active = state.activeProfileId === 'all' || ids.includes(state.activeProfileId as number)
          ? state.activeProfileId
          : profiles[0]?.id ?? 1
        return { profiles, activeProfileId: active }
      })
    } catch {
      // ignore fetch errors
    }
  },
}))

registerProfileGetter(() => useProfileStore.getState().activeProfileId)
