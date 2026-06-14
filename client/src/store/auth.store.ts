import { create } from 'zustand'
import type { User } from '../types'

const REFRESH_TOKEN_KEY = 'sf_refresh_token'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

interface AuthActions {
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // ─── Initial state ──────────────────────────────────────────────────────────
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  // ─── Actions ────────────────────────────────────────────────────────────────

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    set({ user, accessToken, refreshToken, isAuthenticated: true })
  },

  setAccessToken: (token) => {
    set({ accessToken: token })
  },

  logout: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  loadFromStorage: () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (refreshToken) {
      set({ refreshToken })
    }
  },
}))

// ─── Plain getters used by the API client (outside React) ────────────────────

export const getAccessToken = (): string | null =>
  useAuthStore.getState().accessToken

export const getRefreshToken = (): string | null =>
  useAuthStore.getState().refreshToken
