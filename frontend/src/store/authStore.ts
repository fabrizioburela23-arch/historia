import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('mes-token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('mes-token')
        set({ user: null, token: null })
      },
      isAdmin: () => get().user?.role === 'ADMIN'
    }),
    { name: 'mes-auth' }
  )
)
